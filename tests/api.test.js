'use strict';
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.OWNER_PIN = '123456';
process.env.BARISTA_PIN = '654321';
const assert = require('assert');
const orders = require('../api/orders'), session = require('../api/staff/session'), staffOrders = require('../api/staff/orders'), qr = require('../api/staff/qr');
const { issueCustomerToken } = require('../api/_lib');

const call = async (h, { method = 'GET', body, cookie, url = '/', ip = '1.1.1.1', ct = 'application/json', origin } = {}) => {
  if (h === orders && cookie === undefined) {
    cookie = 'cc_customer=' + issueCustomerToken({ uid: 'cust_api_test', phone: '9876543210', name: 'A' });
  }
  const res = { code: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
  await h({ method, url, body, headers: { 'x-real-ip': ip, cookie: cookie || '', 'content-type': ct, host: 'cafe.test', ...(origin ? { origin } : {}) } }, res);
  return res;
};
const login = async (pin, ip) => { const r = await call(session, { method: 'POST', body: { pin }, ip }); return { r, cookie: (r.headers['Set-Cookie'] || '').split(';')[0] }; };
const base = { key: 'abcdefgh-1', table: 0, items: [{ id: 'cappuccino', qty: 2 }], customerName: 'A', phone: '9876543210', paymentMethod: 'digital' };
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('  ok  ' + name); };

(async () => {
  await t('wrong PIN rejected, no cookie', async () => { const { r } = await login('000000', '9.9.9.1'); assert.equal(r.code, 401); assert(!r.headers['Set-Cookie']); });
  await t('lockout after 5 failures, even for the right PIN', async () => {
    for (let i = 0; i < 5; i++) await login('000000', '9.9.9.2');
    const { r } = await login('654321', '9.9.9.2'); assert.equal(r.code, 429);
  });
  const barista = await login('654321', '2.2.2.2'), owner = await login('123456', '3.3.3.3');
  await t('correct PINs give httpOnly strict cookies with the right role', async () => {
    assert.equal(barista.r.body.role, 'barista'); assert.equal(owner.r.body.role, 'owner');
    assert(/HttpOnly/.test(barista.r.headers['Set-Cookie']) && /SameSite=Strict/.test(barista.r.headers['Set-Cookie']));
  });
  await t('staff API without session = 401', async () => { assert.equal((await call(staffOrders)).code, 401); assert.equal((await call(qr, { url: '/?table=1' })).code, 401); });
  await t('forged / tampered cookie rejected', async () => {
    const tok = barista.cookie.replace('cc_staff=', ''); const [b, s] = tok.split('.');
    const forged = Buffer.from(JSON.stringify({ role: 'owner', exp: Date.now() + 1e9, pv: 'x' })).toString('base64url');
    assert.equal((await call(staffOrders, { cookie: 'cc_staff=' + forged + '.' + s })).code, 401);
    assert.equal((await call(staffOrders, { cookie: 'cc_staff=' + b + '.AAAA' })).code, 401);
  });
  await t('barista cannot use owner QR endpoint, owner can', async () => {
    assert.equal((await call(qr, { cookie: barista.cookie, url: '/?table=3' })).code, 403);
    const r = await call(qr, { cookie: owner.cookie, url: '/?table=3' }); assert.equal(r.code, 200); assert(/table=3&sig=/.test(r.body.path));
  });
  await t('customer order without session is rejected with 401', async () => {
    const r = await call(orders, { method: 'POST', body: base, cookie: '' });
    assert.equal(r.code, 401);
  });
  await t('customer order: server prices, UNPAID even if digital', async () => {
    const r = await call(orders, { method: 'POST', body: { ...base, items: [{ id: 'cappuccino', qty: 2, price: 1 }], total: 1, paymentStatus: 'PAID' } });
    assert.equal(r.code, 201); assert.equal(r.body.order.subtotal, 258); assert.equal(r.body.order.total, 270.9); assert.equal(r.body.order.paymentStatus, 'UNPAID');
  });
  await t('same checkout key twice = same order, not a duplicate', async () => {
    const a = await call(orders, { method: 'POST', body: base }); assert.equal(a.code, 200); assert.equal(a.body.order.id, (await call(orders, { method: 'POST', body: base })).body.order.id);
  });
  await t('table order needs the signed QR', async () => {
    assert.equal((await call(orders, { method: 'POST', body: { ...base, key: 'abcdefgh-2', table: 4 } })).code, 400);
    assert.equal((await call(orders, { method: 'POST', body: { ...base, key: 'abcdefgh-3', table: 4, sig: 'a'.repeat(22) } })).code, 400);
    const { path } = (await call(qr, { cookie: owner.cookie, url: '/?table=4' })).body; const sig = path.match(/sig=([^#]+)/)[1];
    assert.equal((await call(orders, { method: 'POST', body: { ...base, key: 'abcdefgh-4', table: 4, sig } })).code, 201);
    assert.equal((await call(orders, { method: 'POST', body: { ...base, key: 'abcdefgh-5', table: 5, sig } })).code, 400); // sig of table 4 on table 5
  });
  await t('bad input rejected (unknown item, qty, phone, empty cart)', async () => {
    const bad = (o, k) => call(orders, { method: 'POST', ip: '6.6.6.6', body: { ...base, key: k, ...o } }).then(r => r.code);
    assert.equal(await bad({ items: [{ id: 'nope', qty: 1 }] }, 'badbad-01'), 400);
    assert.equal(await bad({ items: [{ id: 'cappuccino', qty: -3 }] }, 'badbad-02'), 400);
    assert.equal(await bad({ items: [{ id: 'cappuccino', qty: 99 }] }, 'badbad-03'), 400);
    assert.equal(await bad({ phone: 'drop table' }, 'badbad-04'), 400);
    assert.equal(await bad({ items: [] }, 'badbad-05'), 400);
  });
  await t('HTML in name/notes is neutralised', async () => {
    const r = await call(orders, { method: 'POST', ip: '7.7.7.7', body: { ...base, key: 'xssxss-001', customerName: '<img src=x onerror=alert(1)>', specialNotes: '<script>x</script>' } });
    assert(!/[<>]/.test(r.body.order.customerName + r.body.order.specialNotes));
  });
  await t('order rate limit per device', async () => {
    let last; for (let i = 0; i < 10; i++) last = await call(orders, { method: 'POST', ip: '8.8.8.8', body: { ...base, key: 'ratelim-0' + i } });
    assert.equal(last.code, 429);
  });
  await t('staff sees orders, updates status + payment', async () => {
    const list = (await call(staffOrders, { cookie: barista.cookie })).body.orders; assert(list.length >= 3);
    const id = list[0].id;
    assert.equal((await call(staffOrders, { method: 'PATCH', cookie: barista.cookie, body: { id, status: 'preparing' } })).code, 200);
    assert.equal((await call(staffOrders, { method: 'PATCH', cookie: barista.cookie, body: { id, paid: true } })).code, 200);
    const o = (await call(staffOrders, { cookie: barista.cookie })).body.orders.find(x => x.id === id); assert.equal(o.status, 'preparing'); assert.equal(o.paymentStatus, 'PAID');
    assert.equal((await call(staffOrders, { method: 'PATCH', cookie: barista.cookie, body: { id, status: 'cancelled', cancelReason: 'Item out of stock' } })).code, 200);
    const oc = (await call(staffOrders, { cookie: barista.cookie })).body.orders.find(x => x.id === id);
    assert.equal(oc.status, 'cancelled');
    assert.equal(oc.paymentStatus, 'CANCELLED');
    assert.equal(oc.cancelReason, 'Item out of stock');
    assert.equal((await call(staffOrders, { method: 'PATCH', cookie: barista.cookie, body: { id, status: 'hacked' } })).code, 400);
    assert.equal((await call(staffOrders, { method: 'PATCH', cookie: barista.cookie, body: { id: 'CC-9999999', status: 'ready' } })).code, 404);
  });
  await t('cross-site and non-JSON writes blocked', async () => {
    assert.equal((await call(session, { method: 'POST', body: { pin: '654321' }, origin: 'https://evil.example' })).code, 403);
    assert.equal((await call(session, { method: 'POST', body: 'pin=654321', ct: 'text/plain' })).code, 415);
  });
  await t('logout clears cookie', async () => { const r = await call(session, { method: 'DELETE' }); assert(/Max-Age=0/.test(r.headers['Set-Cookie'])); });
  console.log(`\n${n} checks passed`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
