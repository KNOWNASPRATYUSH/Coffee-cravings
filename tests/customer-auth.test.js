'use strict';
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.OWNER_PIN = '123456';
process.env.BARISTA_PIN = '654321';
const assert = require('assert');
const { tableSig } = require('../api/_lib');
const orders = require('../api/orders');
const customer = require('../api/customer/[action]');
const myOrders = require('../api/my-orders');

const call = async (h, { method = 'GET', body, cookie, url = '/', ip = '1.1.1.1', origin } = {}) => {
  const res = { code: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
  await h({ method, url, body, headers: { 'x-real-ip': ip, cookie: cookie || '', 'content-type': 'application/json', host: 'cafe.test', ...(origin ? { origin } : {}) } }, res);
  return res;
};

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('  ok  ' + name); };

(async () => {
  // 1. Unauthenticated session check
  await t('unauthenticated GET /api/customer/session returns loggedIn: false', async () => {
    const r = await call(customer, { method: 'GET', url: '/api/customer/session', ip: '9.9.9.1' });
    assert.equal(r.code, 200);
    assert.equal(r.body.loggedIn, false);
    assert.equal(r.body.user, null);
  });

  // 2. Google Sign-In via Session endpoint
  let rahulCookie = '';
  await t('POST /api/customer/session creates customer profile & session cookie for Google user', async () => {
    const r = await call(customer, {
      method: 'POST', url: '/api/customer/session', ip: '9.9.9.2',
      body: { uid: 'google-uid-1001', email: 'rahul@gmail.com', name: 'Rahul Sharma', photoUrl: 'https://lh3.googleusercontent.com/test.jpg' }
    });
    assert.equal(r.code, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.user.name, 'Rahul Sharma');
    assert.equal(r.body.user.email, 'rahul@gmail.com');
    assert(r.headers['Set-Cookie'], 'Must set cc_customer cookie');
    rahulCookie = (r.headers['Set-Cookie'] || '').split(';')[0];
    assert(rahulCookie.includes('cc_customer='));
  });

  // 3. Authenticated session check
  await t('GET /api/customer/session with cookie returns active logged-in user', async () => {
    const r = await call(customer, { method: 'GET', url: '/api/customer/session', cookie: rahulCookie, ip: '9.9.9.3' });
    assert.equal(r.code, 200);
    assert.equal(r.body.loggedIn, true);
    assert.equal(r.body.user.name, 'Rahul Sharma');
    assert.equal(r.body.user.email, 'rahul@gmail.com');
  });

  // 4. Logged-in customer places an order
  await t('logged-in customer order stores full permanent receipt with items & prices', async () => {
    const r = await call(orders, {
      method: 'POST', cookie: rahulCookie, ip: '9.9.9.4',
      body: {
        key: 'auth-order-key-1', table: 3, sig: tableSig(3),
        items: [{ id: 'cappuccino', qty: 2 }, { id: 'salted-french-fries', qty: 1 }],
        paymentMethod: 'counter'
      }
    });
    assert.equal(r.code, 201);
    const o = r.body.order;
    assert.equal(o.table, 3);
    assert.equal(o.customerName, 'Rahul Sharma'); // auto-filled from session!
  });

  // 5. Customer fetches lifetime orders
  await t('authenticated GET /api/my-orders returns lifetime orders with item receipts', async () => {
    const r = await call(myOrders, { method: 'GET', cookie: rahulCookie, ip: '9.9.9.5' });
    assert.equal(r.code, 200);
    assert(Array.isArray(r.body.orders));
    assert(r.body.orders.length >= 1, 'Should return at least 1 order');
    const order = r.body.orders[0];
    assert(order.id.startsWith('CC-'));
    assert.equal(order.table, 3);
    assert(Array.isArray(order.items), 'Receipt items must be an array');
    assert.equal(order.items.length, 2);
    const capp = order.items.find(i => i.id === 'cappuccino');
    assert(capp, 'Cappuccino should be in stored receipt');
    assert.equal(capp.qty, 2);
    assert.equal(capp.price, 129);
  });

  // 5b. Live tracking via recent order IDs
  await t('GET /api/my-orders with ?recent=CC-xxxx returns active live order', async () => {
    const r = await call(myOrders, { method: 'GET', url: '/api/my-orders?recent=CC-1001', ip: '9.9.9.5' });
    assert.equal(r.code, 200);
    assert(Array.isArray(r.body.orders));
    assert(r.body.orders.length >= 1, 'Should return active recent order');
    assert.equal(r.body.orders[0].id, 'CC-1001');
  });

  // 6. Gmail OTP: Send OTP
  let devOtpCode = '';
  await t('POST /api/customer/otp action=send generates 6-digit OTP for email', async () => {
    const r = await call(customer, {
      method: 'POST', url: '/api/customer/otp', ip: '9.9.9.6',
      body: { action: 'send', email: 'priya@gmail.com' }
    });
    assert.equal(r.code, 200);
    assert.equal(r.body.ok, true);
    assert(r.body.message.includes('priya@gmail.com'));
    devOtpCode = r.body.devCode;
    assert(devOtpCode && devOtpCode.length === 6, 'Dev code must be 6 digits');
  });

  // 7. Gmail OTP: Verify with wrong OTP fails
  await t('POST /api/customer/otp action=verify with incorrect OTP returns 400', async () => {
    const r = await call(customer, {
      method: 'POST', url: '/api/customer/otp', ip: '9.9.9.7',
      body: { action: 'verify', email: 'priya@gmail.com', otp: '000000' }
    });
    assert.equal(r.code, 400);
    assert.equal(r.body.error, 'Invalid verification code. Please check your email.');
  });

  // 8. Gmail OTP: Verify with correct OTP logs in user
  let priyaCookie = '';
  await t('POST /api/customer/otp action=verify with valid OTP creates session and cookie', async () => {
    const r = await call(customer, {
      method: 'POST', url: '/api/customer/otp', ip: '9.9.9.8',
      body: { action: 'verify', email: 'priya@gmail.com', otp: devOtpCode, name: 'Priya Verma' }
    });
    assert.equal(r.code, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.user.name, 'Priya Verma');
    assert.equal(r.body.user.email, 'priya@gmail.com');
    assert(r.headers['Set-Cookie'], 'Must set cc_customer cookie');
    priyaCookie = (r.headers['Set-Cookie'] || '').split(';')[0];
  });

  // 9. Google 1-Click: POST /api/customer/google with mock JWT token
  await t('POST /api/customer/google creates customer profile and session cookie', async () => {
    const mockPayload = Buffer.from(JSON.stringify({
      sub: 'google-sub-9988',
      email: 'amit@gmail.com',
      name: 'Amit Patel',
      picture: 'https://lh3.googleusercontent.com/amit.png'
    })).toString('base64url');
    const mockJwt = `eyJhbGciOiJIUzI1NiJ9.${mockPayload}.signature`;

    const r = await call(customer, {
      method: 'POST', url: '/api/customer/google', ip: '9.9.9.9',
      body: { credential: mockJwt }
    });
    assert.equal(r.code, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.user.name, 'Amit Patel');
    assert.equal(r.body.user.email, 'amit@gmail.com');
    assert(r.headers['Set-Cookie'], 'Must set cc_customer cookie');
  });

  // 10. Logout clears session cookie
  await t('DELETE /api/customer/session clears cc_customer cookie', async () => {
    const r = await call(customer, { method: 'DELETE', url: '/api/customer/session', cookie: rahulCookie, ip: '9.9.9.10' });
    assert.equal(r.code, 200);
    assert.equal(r.body.ok, true);
    const setCookie = r.headers['Set-Cookie'] || '';
    assert(setCookie.includes('Max-Age=0') || setCookie.includes('cc_customer=;'));
  });

  console.log(`\n${n} Customer Auth & Lifetime History checks passed!`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
