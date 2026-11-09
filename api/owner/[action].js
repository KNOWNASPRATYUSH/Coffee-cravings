'use strict';
// Owner-only admin API: /api/owner/menu, /api/owner/coupons, /api/owner/deals, /api/owner/customers, /api/owner/report
const { HttpError, cmd, pipe, toObj, route, requireStaff, getPins, updateCachedPins, safeEq, issueToken, setSessionCookie, SESSION_MS } = require('../_lib');
const {
  ist, loadMenu, saveMenu, upsertItem,
  loadDeals, cleanDeal,
  cleanCoupon, cleanCode,
  lookupCustomer, listCustomers, getCustomerOrders, getCustomerCoupons
} = require('../_shop');

const parse = (raw) => { try { return JSON.parse(raw); } catch (e) { return null; } };

async function menuApi(req, res) {
  if (req.method === 'GET') return res.json({ menu: await loadMenu() });
  const menu = await loadMenu();
  if (req.method === 'PUT') {
    const item = upsertItem(menu, req.body.item || {});
    await saveMenu(menu);
    return res.json({ item, menu });
  }
  const i = menu.findIndex(m => m.id === req.body.id);
  if (i < 0) throw new HttpError(404, 'Product not found.');
  menu.splice(i, 1);
  await saveMenu(menu);
  res.json({ menu });
}

async function couponsApi(req, res) {
  if (req.method === 'PUT') {
    const c = cleanCoupon(req.body.coupon || {});
    await cmd('HSET', 'coupons', c.code, JSON.stringify(c));
  }
  if (req.method === 'DELETE') await cmd('HDEL', 'coupons', cleanCode(req.body.code));
  const all = Object.values(toObj(await cmd('HGETALL', 'coupons'))).map(parse).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code));
  const uses = all.length ? await pipe(all.map(c => ['GET', 'coupon:uses:' + c.code])) : [];
  res.json({ coupons: all.map((c, i) => ({ ...c, uses: parseInt(uses[i], 10) || 0 })) });
}

async function dealsApi(req, res) {
  if (req.method === 'GET') return res.json({ deals: await loadDeals() });
  if (req.method === 'PUT') {
    const menu = await loadMenu();
    const deal = cleanDeal(req.body.deal || {}, menu);
    await cmd('HSET', 'deals', deal.id, JSON.stringify(deal));
    return res.json({ deal, deals: await loadDeals() });
  }
  if (req.method === 'DELETE') {
    const id = String(req.body.id || '');
    await cmd('HDEL', 'deals', id);
    return res.json({ deals: await loadDeals() });
  }
}

async function customersApi(req, res) {
  if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
  const phone = new URL(req.url, 'http://x').searchParams.get('phone');
  if (phone) {
    const cust = await lookupCustomer(phone);
    if (!cust || !cust.exists) throw new HttpError(404, 'Customer not found.');
    const [orders, couponsUsed] = await Promise.all([getCustomerOrders(phone), getCustomerCoupons(phone)]);
    return res.json({ customer: cust, orders, couponsUsed });
  }
  const customers = await listCustomers(0, 199);
  const totalSpend = customers.reduce((s, c) => s + c.totalSpend, 0);
  res.json({
    customers,
    totals: {
      totalCustomers: customers.length,
      repeatCustomers: customers.filter(c => c.orders > 1).length,
      totalSpend: Math.round(totalSpend * 100) / 100
    }
  });
}

async function reportApi(req, res) {
  const days = Math.min(Math.max(parseInt(new URL(req.url, 'http://x').searchParams.get('days'), 10) || 1, 1), 90);
  const dates = Array.from({ length: days }, (_, i) => ist(Date.now() - i * 86400000).day).reverse();
  const rows = (await pipe(dates.map(d => ['HGETALL', 'stats:' + d]))).map(toObj);
  const R = (p) => Math.round(Number(p || 0)) / 100;
  const t = { orders: 0, revenue: 0, discount: 0, tax: 0, counter: 0, digital: 0, counterOrders: 0, digitalOrders: 0 };
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orders: 0 }));
  const items = new Map(), series = [];
  rows.forEach((h, i) => {
    t.orders += +h.o || 0; t.revenue += +h.rev || 0; t.discount += +h.disc || 0; t.tax += +h.tax || 0;
    t.counter += +h.p_counter || 0; t.digital += +h.p_digital || 0; t.counterOrders += +h.pc_counter || 0; t.digitalOrders += +h.pc_digital || 0;
    series.push({ day: dates[i], orders: +h.o || 0, revenue: R(h.rev), discount: R(h.disc) });
    for (const k of Object.keys(h)) {
      let m;
      if ((m = /^h(\d\d)$/.exec(k))) hours[+m[1]].revenue += +h[k];
      else if ((m = /^ho(\d\d)$/.exec(k))) hours[+m[1]].orders += +h[k];
      else if ((m = /^q:(.+)$/.exec(k))) { const e = items.get(m[1]) || { id: m[1], name: h['n:' + m[1]] || m[1], qty: 0, revenue: 0 }; e.qty += +h[k]; e.name = h['n:' + m[1]] || e.name; items.set(m[1], e); }
      else if ((m = /^r:(.+)$/.exec(k))) { const e = items.get(m[1]) || { id: m[1], name: h['n:' + m[1]] || m[1], qty: 0, revenue: 0 }; e.revenue += +h[k]; items.set(m[1], e); }
    }
  });
  res.json({
    days, from: dates[0], to: dates[dates.length - 1],
    totals: { orders: t.orders, revenue: R(t.revenue), discount: R(t.discount), tax: R(t.tax), avgOrder: t.orders ? R(t.revenue / t.orders) : 0 },
    payments: { counter: { revenue: R(t.counter), orders: t.counterOrders }, digital: { revenue: R(t.digital), orders: t.digitalOrders } },
    series, hours: hours.map(h => ({ ...h, revenue: R(h.revenue) })),
    items: [...items.values()].map(e => ({ ...e, revenue: R(e.revenue) })).sort((a, b) => b.qty - a.qty).slice(0, 50)
  });
}


async function securityApi(req, res) {
  const activePins = await getPins();
  if (req.method === 'GET') {
    const raw = await pipe([['GET', 'cfg:pin:owner'], ['GET', 'cfg:pin:barista']]);
    return res.json({
      hasCustomOwnerPin: Boolean(raw && raw[0]),
      hasCustomBaristaPin: Boolean(raw && raw[1])
    });
  }
  if (req.method === 'PUT') {
    const currentPin = String(req.body.currentPin || '').trim();
    if (!currentPin) throw new HttpError(400, 'Current Owner PIN is required.');
    if (!safeEq(currentPin, activePins.owner)) throw new HttpError(401, 'Current Owner PIN is incorrect.');

    const pinRegex = /^\d{4,12}$/;
    const newOwnerPin = req.body.newOwnerPin !== undefined && req.body.newOwnerPin !== null && String(req.body.newOwnerPin).trim() !== ''
      ? String(req.body.newOwnerPin).trim() : null;
    const newBaristaPin = req.body.newBaristaPin !== undefined && req.body.newBaristaPin !== null && String(req.body.newBaristaPin).trim() !== ''
      ? String(req.body.newBaristaPin).trim() : null;

    if (!newOwnerPin && !newBaristaPin) {
      throw new HttpError(400, 'Please provide a new Owner PIN or Staff PIN.');
    }
    if (newOwnerPin && !pinRegex.test(newOwnerPin)) {
      throw new HttpError(400, 'New Owner PIN must be 4 to 12 digits (numeric only).');
    }
    if (newBaristaPin && !pinRegex.test(newBaristaPin)) {
      throw new HttpError(400, 'New Staff PIN must be 4 to 12 digits (numeric only).');
    }

    const updates = {};
    if (newOwnerPin) {
      await cmd('SET', 'cfg:pin:owner', newOwnerPin);
      await cmd('SET', 'cfg:pin:revoked_before:owner', String(Date.now()));
      updates.owner = newOwnerPin;
    }
    if (newBaristaPin) {
      await cmd('SET', 'cfg:pin:barista', newBaristaPin);
      await cmd('SET', 'cfg:pin:revoked_before:barista', String(Date.now()));
      updates.barista = newBaristaPin;
    }
    updateCachedPins(updates);

    const finalPins = await getPins();
    setSessionCookie(res, issueToken('owner', finalPins.owner), Math.floor(SESSION_MS / 1000));

    return res.json({
      ok: true,
      message: 'PINs updated successfully.',
      ownerPinUpdated: Boolean(newOwnerPin),
      baristaPinUpdated: Boolean(newBaristaPin)
    });
  }
  throw new HttpError(405, 'Method not allowed');
}

async function messagesApi(req, res) {
  if (req.method === 'GET') {
    const ids = await cmd('ZREVRANGE', 'contact:messages', 0, 99);
    if (!ids || !ids.length) return res.json({ messages: [] });
    const raws = await pipe(ids.map(id => ['HGETALL', 'contact:msg:' + id]));
    const messages = raws.map(toObj).filter(m => m && m.id);
    return res.json({ messages });
  }
  if (req.method === 'DELETE') {
    const id = String(req.body && req.body.id || '').trim();
    if (!id) throw new HttpError(400, 'Message ID is required');
    await pipe([
      ['ZREM', 'contact:messages', id],
      ['DEL', 'contact:msg:' + id]
    ]);
    return res.json({ ok: true, id });
  }
  throw new HttpError(405, 'Method not allowed');
}

module.exports = route(['GET', 'PUT', 'DELETE'], async (req, res) => {
  await requireStaff(req, ['owner']);
  const action = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '').split('/').pop();
  if (action === 'menu') return menuApi(req, res);
  if (action === 'coupons') return couponsApi(req, res);
  if (action === 'deals') return dealsApi(req, res);
  if (action === 'customers') return customersApi(req, res);
  if (action === 'messages') return messagesApi(req, res);
  if (action === 'security') return securityApi(req, res);
  if (action === 'report' && req.method === 'GET') return reportApi(req, res);
  throw new HttpError(404, 'Not found');
});
