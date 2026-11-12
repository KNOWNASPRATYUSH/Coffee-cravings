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
    assert.equal(capp.price, 159);
  });

  // 5b. Live tracking via recent order IDs
  await t('GET /api/my-orders with ?recent=CC-xxxx returns active live order', async () => {
    const r = await call(myOrders, { method: 'GET', url: '/api/my-orders?recent=CC-1001', cookie: rahulCookie, ip: '9.9.9.5' });
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
    const mockJwt = `test_eyJhbGciOiJIUzI1NiJ9.${mockPayload}.signature`;

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

  // 10. Logout revokes session server-side and clears cookie
  await t('DELETE /api/customer/session revokes token server-side and clears cookie', async () => {
    const resUser = await call(customer, {
      method: 'POST', url: '/api/customer/session', ip: '9.9.9.10',
      body: { uid: 'user_to_logout_123', email: 'logout@test.com', name: 'Logout User' }
    });
    const tempLogoutCookie = (resUser.headers['Set-Cookie'] || '').split(';')[0];
    const r = await call(customer, { method: 'DELETE', url: '/api/customer/session', cookie: tempLogoutCookie, ip: '9.9.9.10' });
    assert.equal(r.code, 200);
    assert.equal(r.body.ok, true);
    const setCookie = r.headers['Set-Cookie'] || '';
    assert(setCookie.includes('Max-Age=0') || setCookie.includes('cc_customer=;'));

    // Server-side revocation verification: the old token is now rejected
    const check = await call(customer, { method: 'GET', url: '/api/customer/session', cookie: tempLogoutCookie });
    assert.equal(check.body.loggedIn, false, 'Revoked token must not be accepted');
  });

  // ---------- Security Hardening Checks (Claude Audit Verification) ----------

  // 11. Unauthenticated order history rejected
  await t('SECURITY: unauthenticated GET /api/my-orders rejected with 401', async () => {
    const r = await call(myOrders, { method: 'GET', url: '/api/my-orders?phone=9876543210', ip: '9.9.9.11' });
    assert.equal(r.code, 401);
  });

  // 12. Cross-account snooping rejected
  await t('SECURITY: cross-account GET /api/my-orders?phone=victim rejected with 403', async () => {
    // Rahul's active cookie querying someone else's phone
    const r = await call(myOrders, { method: 'GET', url: '/api/my-orders?phone=9999999999', cookie: rahulCookie, ip: '9.9.9.12' });
    assert.equal(r.code, 403);
  });

  // 13. Unauthenticated customer profile query rejected
  await t('SECURITY: unauthenticated GET /api/customer?phone=... rejected with 401', async () => {
    const r = await call(require('../api/customer'), { method: 'GET', url: '/api/customer?phone=9876543210', ip: '9.9.9.13' });
    assert.equal(r.code, 401);
  });

  // 14. Fake Google token rejected
  await t('SECURITY: forged / unverified Google token rejected with 401', async () => {
    const fakePayload = Buffer.from(JSON.stringify({ sub: 'fake_123', email: 'fake@gmail.com' })).toString('base64url');
    const fakeJwt = `forged_header.${fakePayload}.forged_sig`;
    const r = await call(customer, {
      method: 'POST', url: '/api/customer/google', ip: '9.9.9.14',
      body: { credential: fakeJwt }
    });
    assert.equal(r.code, 401);
  });

  // 15. Unauthenticated arbitrary session creation blocked
  await t('SECURITY: unauthenticated POST /api/customer/session blocked in production mode', async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const r = await call(customer, {
        method: 'POST', url: '/api/customer/session', ip: '9.9.9.15',
        body: { uid: 'attacker_123', email: 'hacker@victim.com' }
      });
      assert.equal(r.code, 401);
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });

  // 16. Welcome coupon cannot be farmed with fake phone on same account
  await t('SECURITY: welcome coupon cannot be farmed using different phone on same verified account', async () => {
    const ownerSess = await call(require('../api/staff/session'), { method: 'POST', body: { pin: '123456' }, ip: '9.9.9.16' });
    const ownerCookie = (ownerSess.headers['Set-Cookie'] || '').split(';')[0];
    const ownerAction = require('../api/owner/[action]');
    await call(ownerAction, {
      method: 'PUT', url: '/api/owner/coupons', cookie: ownerCookie,
      body: { coupon: { code: 'FARMTEST', type: 'percent', value: 20, minOrder: 50, active: true, newCustomerOnly: true } }
    });

    // Create a new verified user for this test
    const farmerRes = await call(customer, {
      method: 'POST', url: '/api/customer/session', ip: '9.9.9.16',
      body: { uid: 'farmer_uid_999', email: 'farmer@gmail.com', name: 'Coupon Farmer' }
    });
    const farmerCookie = (farmerRes.headers['Set-Cookie'] || '').split(';')[0];

    // 1st order with phone A by farmer -> succeeds
    const order1 = await call(orders, {
      method: 'POST', cookie: farmerCookie, ip: '9.9.9.17',
      body: {
        key: 'farm-key-01', table: 0, items: [{ id: 'cappuccino', qty: 2 }],
        coupon: 'FARMTEST', phone: '9777711111'
      }
    });
    assert.equal(order1.code, 201);
    assert.equal(order1.body.order.couponCode, 'FARMTEST');

    // 2nd order with fake burner phone B by same farmer -> BLOCKED
    const order2 = await call(orders, {
      method: 'POST', cookie: farmerCookie, ip: '9.9.9.18',
      body: {
        key: 'farm-key-02', table: 0, items: [{ id: 'cappuccino', qty: 2 }],
        coupon: 'FARMTEST', phone: '9777722222' // Different phone!
      }
    });
    assert.equal(order2.code, 400);
    assert(/welcome coupon/i.test(order2.body.error));
  });

  // 17. Customer privacy data deletion
  await t('SECURITY: DELETE /api/customer/session?deleteData=true purges customer profile and revokes session', async () => {
    const userToDel = await call(customer, {
      method: 'POST', url: '/api/customer/session', ip: '9.9.9.19',
      body: { uid: 'user_to_delete_456', email: 'delete_me@test.com', name: 'Delete Me', phone: '9888877777' }
    });
    const delCookie = (userToDel.headers['Set-Cookie'] || '').split(';')[0];

    const delRes = await call(customer, {
      method: 'DELETE', url: '/api/customer/session?deleteData=true',
      cookie: delCookie, ip: '9.9.9.19'
    });
    assert.equal(delRes.code, 200);
    assert.equal(delRes.body.deleted, true);

    // Profile check after deletion: token is revoked
    const profileRes = await call(customer, { method: 'GET', url: '/api/customer/session', cookie: delCookie });
    assert.equal(profileRes.body.loggedIn, false);
  });

  // 18. IDOR Prevention: querying another customer's order ID via ?recent= does not leak it
  await t('SECURITY: IDOR via ?recent=CC-xxxx does not leak other customer orders', async () => {
    // Priya is logged in with priyaCookie, tries to probe Rahul's order CC-1001
    const r = await call(myOrders, {
      method: 'GET', url: '/api/my-orders?recent=CC-1001',
      cookie: priyaCookie, ip: '9.9.9.20'
    });
    assert.equal(r.code, 200);
    assert(Array.isArray(r.body.orders));
    const leaked = r.body.orders.find(o => o.id === 'CC-1001');
    assert(!leaked, 'Must NOT leak Rahul order CC-1001 to Priya!');
  });

  // 19. Finding 1: Google token audience and issuer validation
  await t('SECURITY (Finding 1): Google sign-in rejects token with mismatched audience or issuer', async () => {
    // Simulated token with unknown aud
    const wrongAudPayload = Buffer.from(JSON.stringify({
      sub: 'google-sub-foreign',
      aud: 'different-app.apps.googleusercontent.com',
      iss: 'accounts.google.com',
      email: 'foreign@gmail.com',
      email_verified: true
    })).toString('base64url');
    const wrongAudJwt = `test_header.${wrongAudPayload}.sig`;

    const r1 = await call(customer, {
      method: 'POST', url: '/api/customer/google', ip: '9.9.9.21',
      body: { credential: wrongAudJwt }
    });
    assert.equal(r1.code, 401);

    // Simulated token with unverified email
    const unverifiedPayload = Buffer.from(JSON.stringify({
      sub: 'google-sub-unverified',
      aud: '377404973368-123d5bckj1lehthnjoilnt07udsvnn2m.apps.googleusercontent.com',
      iss: 'accounts.google.com',
      email: 'unverified@gmail.com',
      email_verified: false
    })).toString('base64url');
    const unverifiedJwt = `test_header.${unverifiedPayload}.sig`;

    const r2 = await call(customer, {
      method: 'POST', url: '/api/customer/google', ip: '9.9.9.22',
      body: { credential: unverifiedJwt }
    });
    assert.equal(r2.code, 401);
  });

  // 20. Finding 2: Authenticated customer without verified phone cannot snoop unlinked phone records
  await t('SECURITY (Finding 2): customer profile lookup fails closed for unlinked phone records (403)', async () => {
    // Create an authenticated account with NO phone linked (e.g. Google user)
    const noPhoneUser = await call(customer, {
      method: 'POST', url: '/api/customer/session', ip: '9.9.9.23',
      body: { uid: 'google_user_nophone', email: 'nophone@test.com', name: 'No Phone User' }
    });
    const noPhoneCookie = (noPhoneUser.headers['Set-Cookie'] || '').split(';')[0];

    // Attempt to lookup an arbitrary phone number in the system
    const r = await call(require('../api/customer'), {
      method: 'GET', url: '/api/customer?phone=9876543210',
      cookie: noPhoneCookie, ip: '9.9.9.24'
    });
    assert.equal(r.code, 403, 'Must return 403 Forbidden for unlinked phone lookup');
  });

  // 21. Finding 3: Test bypasses stay closed if VERCEL=true or NODE_ENV=production
  await t('SECURITY (Finding 3): test bypasses remain strictly closed in production mode', async () => {
    const origVercel = process.env.VERCEL;
    try {
      process.env.VERCEL = '1'; // simulate production deployment environment
      // Try to create unauthenticated session using test bypass
      const r = await call(customer, {
        method: 'POST', url: '/api/customer/session', ip: '9.9.9.25',
        body: { uid: 'bypass_attacker', email: 'attacker@evil.com' }
      });
      assert.equal(r.code, 401);
    } finally {
      if (origVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = origVercel;
    }
  });

  // 22. Finding 5: Production fails fast when Redis is missing instead of silently using in-memory store
  await t('SECURITY (Finding 5): missing Redis in production fails fast with 500 error', async () => {
    const origVercel = process.env.VERCEL;
    const { pipe } = require('../api/_lib');
    try {
      process.env.VERCEL = '1';
      let threw = false;
      try {
        await pipe([['GET', 'test_key']]);
      } catch (err) {
        threw = true;
        assert.equal(err.status, 500);
        assert(err.message.includes('Database configuration missing'));
      }
      assert(threw, 'Must throw 500 error when Redis config is missing in production');
    } finally {
      if (origVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = origVercel;
    }
  });

  // 23. Finding 6: photoUrl sanitization rejects quotes, HTML injection, and unauthorized protocols
  await t('SECURITY (Finding 6): photoUrl sanitizes URLs and rejects malicious payloads', async () => {
    const { sanitizePhotoUrl } = require('../api/_shop');
    assert.equal(sanitizePhotoUrl('https://example.com/"onerror=alert(1)'), '');
    assert.equal(sanitizePhotoUrl('javascript:alert(1)'), '');
    assert.equal(sanitizePhotoUrl('https://evil-phishing.com/avatar.jpg'), '');
    assert.equal(sanitizePhotoUrl('https://lh3.googleusercontent.com/a/ACg8ocI...'), 'https://lh3.googleusercontent.com/a/ACg8ocI...');
  });

  // 24. Finding 1: Attacker cannot claim or overwrite another customer's phone binding
  await t('SECURITY (Finding 1): Attacker cannot claim or overwrite another customer phone binding (409)', async () => {
    // Legitimate customer binds phone A
    const victim = await call(customer, {
      method: 'POST', url: '/api/customer/session', ip: '9.9.9.27',
      body: { uid: 'victim_uid_888', email: 'victim@test.com', phone: '9111122222', name: 'Victim Customer' }
    });
    assert.equal(victim.code, 200);

    // Attacker logs in with their own account
    const attacker = await call(customer, {
      method: 'POST', url: '/api/customer/session', ip: '9.9.9.28',
      body: { uid: 'attacker_uid_999', email: 'attacker@evil.com', name: 'Attacker' }
    });
    const attackerCookie = (attacker.headers['Set-Cookie'] || '').split(';')[0];

    // Attacker tries to update their profile claiming the victim's phone number
    const claimAttempt = await call(customer, {
      method: 'POST', url: '/api/customer/session', cookie: attackerCookie, ip: '9.9.9.28',
      body: { phone: '9111122222' }
    });
    assert.equal(claimAttempt.code, 409, 'Must reject hijacking an already-bound phone number with 409 Conflict');

    // Attacker calling deleteCustomerData must NOT delete victim's phone-keyed orders
    const deleteAttempt = await call(customer, {
      method: 'DELETE', url: '/api/customer/session?deleteData=true', cookie: attackerCookie, ip: '9.9.9.28'
    });
    assert.equal(deleteAttempt.code, 200);

    // Verify victim's phone profile remains intact
    const victimPhoneRecord = await require('../api/_shop').lookupCustomer('9111122222');
    assert.equal(victimPhoneRecord.exists, true, 'Victim profile must NOT be deleted by attacker');
  });

  // 25. Finding 10: OTP is stored as a peppered HMAC
  await t('SECURITY (Finding 10): OTP hashes are peppered with server secret', async () => {
    const r = await call(customer, {
      method: 'POST', url: '/api/customer/otp', ip: '9.9.9.29',
      body: { action: 'send', email: 'hmactest@gmail.com' }
    });
    assert.equal(r.code, 200);
    const rawStored = await require('../api/_lib').cmd('GET', 'cust:otp:hmactest@gmail.com');
    assert(rawStored && rawStored.length === 64, 'Must store 64-char hex HMAC');
    // Verify an unkeyed sha256 does NOT match the stored HMAC
    const unkeyedSha = require('crypto').createHash('sha256').update(String(r.body.devCode)).digest('hex');
    assert.notEqual(rawStored, unkeyedSha, 'Must NOT be an unkeyed SHA-256');
  });

  // 26. Finding 15: Email OTP reports failure when email delivery fails in production
  await t('SECURITY (Finding 15): Email OTP returns 503 if provider delivery fails in production', async () => {
    const origVercel = process.env.VERCEL;
    const origFetch = global.fetch;
    try {
      process.env.VERCEL = '1';
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token-test-12345';
      global.fetch = async (url, opts) => {
        if (typeof url === 'string' && url.includes('/pipeline')) {
          return {
            ok: true,
            status: 200,
            json: async () => [{ result: 1 }, { result: 1 }]
          };
        }
        return { ok: false, status: 500 };
      };

      const r = await call(customer, {
        method: 'POST', url: '/api/customer/otp', ip: '9.9.9.30',
        body: { action: 'send', email: 'failtest@gmail.com' }
      });
      assert.equal(r.code, 503, 'Must return 503 error when email cannot be delivered');
    } finally {
      global.fetch = origFetch;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      if (origVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = origVercel;
    }
  });

  console.log(`\n${n} Customer Auth, Security & Lifetime History checks passed!`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
