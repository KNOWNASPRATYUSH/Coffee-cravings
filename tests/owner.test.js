'use strict';
process.env.SESSION_SECRET = 'x'.repeat(40); process.env.OWNER_PIN = '8044'; process.env.BARISTA_PIN = '0508';
const assert = require('assert');
const orders = require('../api/orders'), session = require('../api/staff/session'), staff = require('../api/staff/orders'), owner = require('../api/owner/[action]'), config = require('../api/config');
const { issueCustomerToken } = require('../api/_lib');
const custCookie = 'cc_customer=' + issueCustomerToken({ uid: 'cust_owner_test', phone: '9876543210', name: 'T' });

const call = async (h, { method = 'GET', body, cookie = '', url = '/', ip = '1.1.1.1' } = {}) => {
  const res = { code: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
  await h({ method, url, body, headers: { 'x-real-ip': ip, cookie, 'content-type': 'application/json', host: 'cafe.test' } }, res); return res;
};
const login = async (pin, ip) => (await call(session, { method: 'POST', body: { pin }, ip })).headers['Set-Cookie'].split(';')[0];
let seq = 0;
const order = (items, extra = {}) => call(orders, { method: 'POST', cookie: custCookie, ip: '10.0.' + (++seq) + '.1', body: { key: 'owner-test-' + String(++seq).padStart(4, '0'), table: 0, items, customerName: 'T', phone: '9876543210', paymentMethod: 'counter', ...extra } });
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('  ok  ' + name); };

(async () => {
  let O = await login('8044', '2.0.0.1'), B = await login('0508', '2.0.0.2');
  const api = (path, o = {}) => call(owner, { url: '/api/owner/' + path, cookie: O, ...o });

  await t('only the owner can use the admin API', async () => {
    assert.equal((await call(owner, { url: '/api/owner/menu' })).code, 401);
    assert.equal((await call(owner, { url: '/api/owner/menu', cookie: B })).code, 403);
    assert.equal((await api('menu')).code, 200);
  });
  let brownie;
  await t('add a product -> customers see it and are charged the server price', async () => {
    const r = await api('menu', { method: 'PUT', body: { item: { name: 'Choco Brownie', price: 99.5, category: 'desserts', categoryName: 'Desserts', description: 'Warm & gooey', image: 'https://example.com/b.jpg', featured: true } } });
    assert.equal(r.code, 200); brownie = r.body.item.id; assert.equal(brownie, 'choco-brownie');
    const pub = (await call(config)).body.menu; assert(pub.some(i => i.id === brownie)); assert(pub.length >= 20);
    const o = await order([{ id: brownie, qty: 2, price: 1 }]); assert.equal(o.code, 201); assert.equal(o.body.order.subtotal, 199);
  });
  await t('edit price, then hide: hidden items vanish and cannot be ordered', async () => {
    await api('menu', { method: 'PUT', body: { item: { id: brownie, name: 'Choco Brownie', price: 120, category: 'desserts', categoryName: 'Desserts', available: true } } });
    assert.equal((await order([{ id: brownie, qty: 1 }])).body.order.subtotal, 120);
    await api('menu', { method: 'PUT', body: { item: { id: brownie, name: 'Choco Brownie', price: 120, category: 'desserts', available: false } } });
    assert(!(await call(config)).body.menu.some(i => i.id === brownie));
    assert.equal((await order([{ id: brownie, qty: 1 }])).code, 400);
  });
  await t('bad product data rejected / HTML stripped', async () => {
    const bad = (item) => api('menu', { method: 'PUT', body: { item } }).then(r => r.code);
    assert.equal(await bad({ name: 'X', price: -5, category: 'desserts' }), 400);
    assert.equal(await bad({ name: 'X', price: 10, category: 'Bad Category!' }), 400);
    assert.equal(await bad({ name: 'X', price: 10, category: 'desserts', image: 'http://insecure.com/a.jpg' }), 400);
    assert.equal(await bad({ name: 'X', price: 10, category: 'desserts', image: 'https://a.com/"onerror=alert(1)' }), 400);
    const r = await api('menu', { method: 'PUT', body: { item: { name: '<img src=x onerror=1>Tea', price: 10, category: 'desserts' } } });
    assert(!/[<>]/.test(r.body.item.name));
    assert.equal((await api('menu', { method: 'DELETE', body: { id: r.body.item.id } })).code, 200);
  });
  await t('percent coupon with cap: discount before GST, server decides', async () => {
    const mk = (c) => api('coupons', { method: 'PUT', body: { coupon: c } });
    assert.equal((await mk({ code: 'save10', type: 'percent', value: 10, minOrder: 100, maxDiscount: 50 })).code, 200);
    const rule = (await call(config, { url: '/api/config?coupon=save10' })).body.coupon; assert.equal(rule.code, 'SAVE10');
    const o = (await order([{ id: 'cappuccino', qty: 2 }], { coupon: 'SAVE10' })).body.order; // 318 -> -31.80 -> 286.20 + 14.31 GST = 300.51
    assert.deepEqual([o.subtotal, o.discount, o.tax, o.total, o.couponCode], [318, 31.8, 14.31, 300.51, 'SAVE10']);
    const big = (await order([{ id: 'cappuccino', qty: 10 }], { coupon: 'SAVE10' })).body.order; assert.equal(big.discount, 50); // capped
  });
  await t('flat coupon, min order, expiry, usage limit, unknown code', async () => {
    const mk = (c) => api('coupons', { method: 'PUT', body: { coupon: c } });
    await mk({ code: 'FLAT50', type: 'flat', value: 50, minOrder: 300 });
    assert.equal((await order([{ id: 'cappuccino', qty: 1 }], { coupon: 'FLAT50' })).code, 400);          // below minimum
    assert.equal((await order([{ id: 'cappuccino', qty: 3 }], { coupon: 'FLAT50' })).body.order.discount, 50);
    await mk({ code: 'OLD', type: 'flat', value: 10, expiresAt: '2020-01-01' });
    assert.equal((await order([{ id: 'cappuccino', qty: 1 }], { coupon: 'OLD' })).code, 400);
    await mk({ code: 'ONCE', type: 'flat', value: 10, maxUses: 1 });
    assert.equal((await order([{ id: 'cappuccino', qty: 1 }], { coupon: 'ONCE' })).code, 201);
    assert.equal((await order([{ id: 'cappuccino', qty: 1 }], { coupon: 'ONCE' })).code, 400);
    assert.equal((await order([{ id: 'cappuccino', qty: 1 }], { coupon: 'NOPE' })).code, 400);
    assert.equal((await call(config, { url: '/api/config?coupon=NOPE' })).code, 400);
    const list = (await api('coupons')).body.coupons; assert.equal(list.find(c => c.code === 'ONCE').uses, 1);
    await mk({ code: 'FLAT50', type: 'flat', value: 50, minOrder: 300, active: false });
    assert.equal((await order([{ id: 'cappuccino', qty: 3 }], { coupon: 'FLAT50' })).code, 400);          // switched off
    assert.equal((await api('coupons', { method: 'DELETE', body: { code: 'OLD' } })).body.coupons.some(c => c.code === 'OLD'), false);
  });
  await t('coupon ruleset: perCustomerLimit prevents repeat abuse while allowing configured repeat uses', async () => {
    const mk = (c) => api('coupons', { method: 'PUT', body: { coupon: c } });
    await mk({ code: 'TWICE', type: 'flat', value: 20, minOrder: 100, perCustomerLimit: 2 });

    // 1st order by user T -> 201
    assert.equal((await order([{ id: 'cappuccino', qty: 2 }], { coupon: 'TWICE' })).code, 201);
    // 2nd order by user T -> 201 (limit is 2)
    assert.equal((await order([{ id: 'cappuccino', qty: 2 }], { coupon: 'TWICE' })).code, 201);
    // 3rd order by user T -> 400 BLOCKED (limit reached!)
    const r3 = await order([{ id: 'cappuccino', qty: 2 }], { coupon: 'TWICE' });
    assert.equal(r3.code, 400);
    assert(/maximum limit/i.test(r3.body.error));
  });

  await t('staff polling is cheap: unchanged until something changes', async () => {
    const first = (await call(staff, { cookie: B })).body; assert(first.orders.length > 0 && first.rev);
    assert.equal((await call(staff, { cookie: B, url: '/?rev=' + first.rev })).body.unchanged, true);
    await call(staff, { method: 'PATCH', cookie: B, body: { id: first.orders[0].id, status: 'ready' } });
    assert.equal((await call(staff, { cookie: B, url: '/?rev=' + first.rev })).body.unchanged, undefined);
  });
  await t('owner security API: change Owner and Staff PINs with verification and session refresh', async () => {
    // 1. GET status
    const initialSec = await api('security');
    assert.equal(initialSec.code, 200);

    // 2. PUT without current PIN -> 400
    assert.equal((await api('security', { method: 'PUT', body: { newOwnerPin: '998877' } })).code, 400);

    // 3. PUT with wrong current PIN -> 401
    assert.equal((await api('security', { method: 'PUT', body: { currentPin: '0000', newOwnerPin: '998877' } })).code, 401);

    // 4. PUT with invalid pin format (e.g. letters or too short) -> 400
    assert.equal((await api('security', { method: 'PUT', body: { currentPin: '8044', newOwnerPin: 'abc' } })).code, 400);
    assert.equal((await api('security', { method: 'PUT', body: { currentPin: '8044', newOwnerPin: '12' } })).code, 400);

    // 5. Valid update of both Owner and Barista PIN
    const updateRes = await api('security', {
      method: 'PUT',
      body: { currentPin: '8044', newOwnerPin: '998877', newBaristaPin: '334455' }
    });
    assert.equal(updateRes.code, 200);
    assert.equal(updateRes.body.ok, true);
    assert(updateRes.headers['Set-Cookie']); // refreshed session cookie issued

    // 6. Old Owner PIN "8044" is now rejected
    const oldLogin = await call(session, { method: 'POST', body: { pin: '8044' }, ip: '2.0.0.9' });
    assert.equal(oldLogin.code, 401);

    // 7. New Owner PIN "998877" succeeds
    const newOwnerLogin = await call(session, { method: 'POST', body: { pin: '998877' }, ip: '2.0.0.9' });
    assert.equal(newOwnerLogin.code, 200);
    assert.equal(newOwnerLogin.body.role, 'owner');
    const newOwnerCookie = newOwnerLogin.headers['Set-Cookie'].split(';')[0];
    // Subsequent calls with the new PIN session succeed without session expiry
    const testMenu = await call(owner, { url: '/api/owner/menu', cookie: newOwnerCookie });
    assert.equal(testMenu.code, 200);
    const testOrders = await call(staff, { cookie: newOwnerCookie });
    assert.equal(testOrders.code, 200);

    // 8. Old Barista PIN "0508" is now rejected
    const oldBaristaLogin = await call(session, { method: 'POST', body: { pin: '0508' }, ip: '2.0.0.9' });
    assert.equal(oldBaristaLogin.code, 401);

    // 9. New Barista PIN "334455" succeeds
    const newBaristaLogin = await call(session, { method: 'POST', body: { pin: '334455' }, ip: '2.0.0.9' });
    assert.equal(newBaristaLogin.code, 200);
    assert.equal(newBaristaLogin.body.role, 'barista');

    // 10. Revert PINs back so remaining tests/runs have default PINs
    const revertRes = await call(owner, {
      url: '/api/owner/security',
      method: 'PUT',
      cookie: newOwnerCookie,
      body: { currentPin: '998877', newOwnerPin: '8044', newBaristaPin: '0508' }
    });
    assert.equal(revertRes.code, 200);
    O = revertRes.headers['Set-Cookie'].split(';')[0];
    B = await login('0508', '2.0.0.2');
  });

  await t('sales report counts only PAID orders, once, with item + payment breakdown', async () => {
    const before = (await api('report?days=1')).body.totals;
    const o = (await order([{ id: 'cappuccino', qty: 2 }, { id: 'americano', qty: 1 }])).body.order; // 457 + 22.85 GST = 479.85
    assert.equal((await api('report?days=1')).body.totals.orders, before.orders);                      // unpaid -> not a sale yet
    await call(staff, { method: 'PATCH', cookie: B, body: { id: o.id, paid: true } });
    await call(staff, { method: 'PATCH', cookie: B, body: { id: o.id, paid: true } });                  // double click
    const r = (await api('report?days=1')).body;
    assert.equal(r.totals.orders, before.orders + 1); assert.equal(Math.round((r.totals.revenue - before.revenue) * 100) / 100, 479.85);
    assert.equal(r.items.find(i => i.id === 'cappuccino').qty >= 2, true); assert(r.payments.counter.orders >= 1);
    assert.equal(r.hours.reduce((s, h) => s + h.orders, 0), r.totals.orders);
    assert.equal((await api('report?days=7')).body.series.length, 7);
  });
  console.log(`\n${n} owner checks passed`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
