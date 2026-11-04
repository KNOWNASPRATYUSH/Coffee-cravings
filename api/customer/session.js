'use strict';
// Customer Session Endpoint: /api/customer/session
// Handles login (Google / Phone OTP via Firebase) and session state.
const { HttpError, route, customerOf, issueCustomerToken, setCustomerCookie, clearCustomerCookie, clientIp, pipe } = require('../_lib');
const { upsertCustomerUser, getCustomerUser, cleanPhone, text } = require('../_shop');

module.exports = route(['GET', 'POST', 'DELETE'], async (req, res) => {
  // Check active session
  if (req.method === 'GET') {
    const cust = customerOf(req);
    if (!cust) return res.json({ loggedIn: false, user: null });
    const profile = await getCustomerUser(cust.uid);
    return res.json({ loggedIn: true, user: profile || cust });
  }

  // Logout
  if (req.method === 'DELETE') {
    clearCustomerCookie(res);
    return res.json({ ok: true });
  }

  // Login / Session creation
  const b = req.body || {};
  const uid = text(b.uid, 128);
  if (!uid || uid.length < 3) {
    throw new HttpError(400, 'Valid customer account is required.');
  }

  // Rate limit: 20 login attempts per 10 minutes per IP
  const rlKey = 'rl:custlogin:' + clientIp(req);
  const [n] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (n > 20) throw new HttpError(429, 'Too many login attempts. Please wait a few minutes.');

  const email = String(b.email || '').trim().toLowerCase().slice(0, 100);
  const phone = cleanPhone(b.phone);
  const name = text(b.name || b.displayName, 60) || (email ? email.split('@')[0] : 'Coffee Lover');
  const photoUrl = String(b.photoUrl || b.photoURL || '').trim().slice(0, 400);

  // Upsert profile in Redis
  const user = await upsertCustomerUser({ uid, email, phone, name, photoUrl });

  // Issue secure HttpOnly session cookie
  const token = issueCustomerToken(user);
  setCustomerCookie(res, token);

  res.status(200).json({ ok: true, user });
});
