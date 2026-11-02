'use strict';
process.env.SESSION_SECRET = 'x'.repeat(40); process.env.OWNER_PIN = '123456'; process.env.BARISTA_PIN = '654321';
process.env.RAZORPAY_KEY_ID = 'rzp_test_abc'; process.env.RAZORPAY_KEY_SECRET = 'keysecret123'; process.env.RAZORPAY_WEBHOOK_SECRET = 'hooksecret123';
const assert = require('assert'), crypto = require('crypto');
let gwN = 0, gwDown = false;
global.fetch = async (url) => { assert(/api\.razorpay\.com\/v1\/orders/.test(url)); if (gwDown) return { ok: false, status: 500, text: async () => 'x' }; return { ok: true, json: async () => ({ id: 'order_TEST' + (++gwN) + 'abcdef' }) }; };
const orders = require('../api/orders'), session = require('../api/staff/session'), staff = require('../api/staff/orders'), verify = require('../api/payments/verify'), hook = require('../api/payments/webhook'), config = require('../api/config');

const call = async (h, { method = 'POST', body, cookie = '', ip = '1.1.1.1', headers = {}, raw } = {}) => {
  const res = { code: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
  await h({ method, url: '/', body, rawBody: raw, headers: { 'x-real-ip': ip, cookie, 'content-type': 'application/json', host: 'cafe.test', ...headers } }, res); return res;
};
const hex = (k, d) => crypto.createHmac('sha256', k).update(d).digest('hex');
const mk = (key, extra = {}) => call(orders, { ip: '4.4.' + Math.floor(Math.random() * 250) + '.1', body: { key, table: 0, items: [{ id: 'cappuccino', qty: 1 }], customerName: 'A', phone: '9876543210', paymentMethod: 'digital', ...extra } });
const hookCall = (evt, sig) => { const raw = Buffer.from(JSON.stringify(evt)); return call(hook, { raw, body: undefined, headers: { 'x-razorpay-signature': sig === undefined ? hex('hooksecret123', raw) : sig } }); };
const captured = (gid, pid, amount) => ({ event: 'payment.captured', payload: { payment: { entity: { id: pid, order_id: gid, amount, status: 'captured' } } } });
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('  ok  ' + name); };

(async () => {
  const b = await call(session, { body: { pin: '654321' } }); const cookie = b.headers['Set-Cookie'].split(';')[0];
  const barista = async () => (await call(staff, { method: 'GET', cookie })).body.orders;

  await t('config reports gateway on', async () => assert.equal((await call(config, { method: 'GET' })).body.gateway, true));
  let o1, p1;
  await t('online order is created awaiting payment and HIDDEN from barista', async () => {
    const r = await mk('online-0001'); assert.equal(r.code, 201); o1 = r.body.order; p1 = r.body.payment;
    assert.equal(o1.status, 'awaiting_payment'); assert.equal(o1.paymentStatus, 'PENDING'); assert.equal(p1.amount, 13545); assert.equal(p1.keyId, 'rzp_test_abc');
    assert(!(await barista()).some(o => o.id === o1.id));
  });
  await t('retry of same checkout returns same pending order + same payment window data', async () => {
    const r = await mk('online-0001'); assert.equal(r.code, 200); assert.equal(r.body.order.id, o1.id); assert.equal(r.body.payment.orderId, p1.orderId);
  });
  await t('forged / wrong-signature verify is rejected, order stays hidden', async () => {
    const bad = await call(verify, { body: { razorpay_order_id: p1.orderId, razorpay_payment_id: 'pay_FAKE12345', razorpay_signature: 'f'.repeat(64) } });
    assert.equal(bad.code, 400); assert(!(await barista()).some(o => o.id === o1.id));
  });
  await t('valid verify marks PAID and the barista now sees it', async () => {
    const pid = 'pay_REAL12345', sig = hex('keysecret123', p1.orderId + '|' + pid);
    const r = await call(verify, { body: { razorpay_order_id: p1.orderId, razorpay_payment_id: pid, razorpay_signature: sig } }); assert.equal(r.code, 200);
    const o = (await barista()).find(x => x.id === o1.id); assert(o); assert.equal(o.paymentStatus, 'PAID'); assert.equal(o.status, 'new');
  });
  await t('webhook alone (customer closed the tab) also marks PAID; replay is harmless', async () => {
    const r = await mk('online-0002'); const gid = r.body.payment.orderId, id = r.body.order.id;
    assert(!(await barista()).some(o => o.id === id));
    assert.equal((await hookCall(captured(gid, 'pay_WH0001', r.body.payment.amount))).code, 200);
    assert.equal((await barista()).find(o => o.id === id).paymentStatus, 'PAID');
    assert.equal((await hookCall(captured(gid, 'pay_WH0001', r.body.payment.amount))).code, 200);
  });
  await t('webhook with bad signature rejected; wrong amount ignored', async () => {
    const r = await mk('online-0003'); const gid = r.body.payment.orderId, id = r.body.order.id;
    assert.equal((await hookCall(captured(gid, 'pay_X', r.body.payment.amount), 'deadbeef')).code, 400);
    assert.equal((await hookCall(captured(gid, 'pay_X', 100))).code, 200);
    assert(!(await barista()).some(o => o.id === id));
  });
  await t('pay-at-counter still goes straight to barista as UNPAID', async () => {
    const r = await mk('counter-001', { paymentMethod: 'counter' }); assert.equal(r.body.payment, null);
    assert.equal((await barista()).find(o => o.id === r.body.order.id).paymentStatus, 'UNPAID');
  });
  await t('gateway outage: clear error, no half-created order, retry works', async () => {
    gwDown = true; const bad = await mk('outage-0001'); assert.equal(bad.code, 502); gwDown = false;
    const ok = await mk('outage-0001'); assert.equal(ok.code, 201);
  });
  console.log(`\n${n} payment checks passed`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
