'use strict';
// Owner-only admin API: /api/owner/menu, /api/owner/coupons, /api/owner/report
const { HttpError, cmd, pipe, toObj, route, requireStaff } = require('../_lib');
const { ist, loadMenu, saveMenu, upsertItem, cleanCoupon, cleanCode } = require('../_shop');

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
  if (req.method === 'PUT') { const c = cleanCoupon(req.body.coupon || {}); await cmd('HSET', 'coupons', c.code, JSON.stringify(c)); }
  if (req.method === 'DELETE') await cmd('HDEL', 'coupons', cleanCode(req.body.code));
  const all = Object.values(toObj(await cmd('HGETALL', 'coupons'))).map(parse).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code));
  const uses = all.length ? await pipe(all.map(c => ['GET', 'coupon:uses:' + c.code])) : [];
  res.json({ coupons: all.map((c, i) => ({ ...c, uses: parseInt(uses[i], 10) || 0 })) });
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

module.exports = route(['GET', 'PUT', 'DELETE'], async (req, res) => {
  requireStaff(req, ['owner']);
  const action = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '').split('/').pop();
  if (action === 'menu') return menuApi(req, res);
  if (action === 'coupons') return couponsApi(req, res);
  if (action === 'report' && req.method === 'GET') return reportApi(req, res);
  throw new HttpError(404, 'Not found');
});
