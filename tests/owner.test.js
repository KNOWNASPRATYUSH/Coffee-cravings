'use strict';
process.env.SESSION_SECRET = 'x'.repeat(40); process.env.OWNER_PIN = '8044'; process.env.BARISTA_PIN = '0508';
const assert = require('assert');
const orders = require('../api/orders'), session = require('../api/staff/session'), staff = require('../api/staff/orders'), owner = require('../api/owner/[action]'), config = require('../api/config');

const call = async (h, { method = 'GET', body, cookie = '', url = '/', ip = '1.1.1.1' } = {}) => {
  const res = { code: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
  await h({ method, url, body, headers: { 'x-real-ip': ip, cookie, 'content-type': 'application/json', host: 'cafe.test' } }, res); return res;
};
const login = async (pin, ip) => (await call(session, { method: 'POST', body: { pin }, ip })).headers['Set-Cookie'].split(';')[0];
let seq = 0;
const order = (items, extra = {}) => call(orders, { method: 'POST', ip: '10.0.' + (++seq) + '.1', body: { key: 'owner-test-' + String(++seq).padStart(4, '0'), table: 0, items, customerName: 'T', phone: '9876543210', paymentMethod: 'counter', ...extra } });
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('  ok  ' + name); };

(async () => {
  const O = await login('8044', '2.0.0.1'), B = await login('0508', '2.0.0.2');
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
    const pub = (await call(config)).body.menu; assert(pub.some(i => i.id === brownie)); assert.equal(pub.length, 20);
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
    const o = (await order([{ id: 'cappuccino', qty: 2 }], { coupon: 'SAVE10' })).body.order; // 258 -> -25.80 -> 232.20 + 11.61 GST
    assert.deepEqual([o.subtotal, o.discount, o.tax, o.total, o.couponCode], [258, 25.8, 11.61, 243.81, 'SAVE10']);
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
  await t('staff polling is cheap: unchanged until something changes', async () => {
    const first = (await call(staff, { cookie: B })).body; assert(first.orders.length > 0 && first.rev);
    assert.equal((await call(staff, { cookie: B, url: '/?rev=' + first.rev })).body.unchanged, true);
    await call(staff, { method: 'PATCH', cookie: B, body: { id: first.orders[0].id, status: 'ready' } });
    assert.equal((await call(staff, { cookie: B, url: '/?rev=' + first.rev })).body.unchanged, undefined);
  });
  await t('sales report counts only PAID orders, once, with item + payment breakdown', async () => {
    const before = (await api('report?days=1')).body.totals;
    const o = (await order([{ id: 'cappuccino', qty: 2 }, { id: 'americano', qty: 1 }])).body.order; // 387 + 19.35 GST = 406.35
    assert.equal((await api('report?days=1')).body.totals.orders, before.orders);                      // unpaid -> not a sale yet
    await call(staff, { method: 'PATCH', cookie: B, body: { id: o.id, paid: true } });
    await call(staff, { method: 'PATCH', cookie: B, body: { id: o.id, paid: true } });                  // double click
    const r = (await api('report?days=1')).body;
    assert.equal(r.totals.orders, before.orders + 1); assert.equal(Math.round((r.totals.revenue - before.revenue) * 100) / 100, 406.35);
    assert.equal(r.items.find(i => i.id === 'cappuccino').qty >= 2, true); assert(r.payments.counter.orders >= 1);
    assert.equal(r.hours.reduce((s, h) => s + h.orders, 0), r.totals.orders);
    assert.equal((await api('report?days=7')).body.series.length, 7);
  });
  console.log(`\n${n} owner checks passed`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
