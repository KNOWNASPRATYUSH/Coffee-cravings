'use strict';
// Unified Customer Auth & Session API: /api/customer/session, /api/customer/otp, /api/customer/google
const crypto = require('crypto');
const {
  HttpError, route, pipe, cmd, clientIp,
  customerOf, issueCustomerToken, setCustomerCookie, clearCustomerCookie
} = require('../_lib');
const { upsertCustomerUser, getCustomerUser, cleanPhone, text } = require('../_shop');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// -----------------------------------------------------------------------------
// 1. Session Handler: /api/customer/session
// -----------------------------------------------------------------------------
async function handleSession(req, res) {
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

  // Session creation / login
  const b = req.body || {};
  const uid = text(b.uid, 128);
  if (!uid || uid.length < 3) {
    throw new HttpError(400, 'Valid customer account is required.');
  }

  const rlKey = 'rl:custlogin:' + clientIp(req);
  const [n] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (n > 20) throw new HttpError(429, 'Too many login attempts. Please wait a few minutes.');

  const email = String(b.email || '').trim().toLowerCase().slice(0, 100);
  const phone = cleanPhone(b.phone);
  const name = text(b.name || b.displayName, 60) || (email ? email.split('@')[0] : 'Coffee Lover');
  const photoUrl = String(b.photoUrl || b.photoURL || '').trim().slice(0, 400);

  const user = await upsertCustomerUser({ uid, email, phone, name, photoUrl });
  const token = issueCustomerToken(user);
  setCustomerCookie(res, token);

  return res.status(200).json({ ok: true, user });
}

// -----------------------------------------------------------------------------
// 2. Email OTP Handler: /api/customer/otp
// -----------------------------------------------------------------------------
async function sendEmailOtp(toEmail, otp) {
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Coffee & Cravings <login@coffeeandcravings.in>',
          to: [toEmail],
          subject: `${otp} is your Coffee & Cravings sign-in code`,
          html: `<div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px;"><h2 style="color:#78350f;">☕ Coffee & Cravings</h2><p>Your one-time sign-in code is:</p><div style="font-size:32px; font-weight:700; letter-spacing:6px; color:#1f2937; margin:20px 0; background:#fef3c7; padding:12px; text-align:center; border-radius:8px;">${otp}</div><p style="color:#6b7280; font-size:13px;">Expires in 5 minutes.</p></div>`
        })
      });
      if (res.ok) return { sent: true };
    } catch (e) {
      console.error('Resend email error:', e);
    }
  }

  if (process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.GMAIL_APP_PASS)) {
    try {
      let nodemailer;
      try { nodemailer = require('nodemailer'); } catch (_) {}
      if (nodemailer) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASS
          }
        });
        await transporter.sendMail({
          from: `"Coffee & Cravings" <${process.env.SMTP_USER}>`,
          to: toEmail,
          subject: `${otp} is your Coffee & Cravings sign-in code`,
          text: `Your one-time sign-in code is: ${otp}. It expires in 5 minutes.`
        });
        return { sent: true };
      }
    } catch (e) {
      console.error('SMTP email error:', e);
    }
  }

  console.log(`[Coffee & Cravings] Verification OTP for ${toEmail}: ${otp}`);
  return { sent: false, devCode: otp };
}

async function handleOtp(req, res) {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const b = req.body || {};
  const action = String(b.action || '').trim().toLowerCase();
  const rawEmail = String(b.email || '').trim().toLowerCase();

  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) || rawEmail.length > 100) {
    throw new HttpError(400, 'Please enter a valid Gmail / Email address.');
  }

  if (action === 'send') {
    const ip = clientIp(req);
    const rlKey = 'rl:otpsend:' + ip;
    const [sendCount] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
    if (sendCount > 10) {
      throw new HttpError(429, 'Too many OTP requests. Please wait a few minutes.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = sha(otp);

    await pipe([
      ['SET', 'cust:otp:' + rawEmail, otpHash, 'EX', 300],
      ['DEL', 'cust:otp:attempts:' + rawEmail]
    ]);

    const result = await sendEmailOtp(rawEmail, otp);
    if (result.sent) {
      return res.json({ ok: true, message: `6-digit verification code sent to ${rawEmail}` });
    } else {
      return res.json({
        ok: true,
        devMode: true,
        devCode: result.devCode,
        message: `Verification code sent to ${rawEmail} (Test code: ${result.devCode})`
      });
    }
  }

  if (action === 'verify') {
    const otp = String(b.otp || '').trim();
    if (!/^\d{6}$/.test(otp)) {
      throw new HttpError(400, 'Please enter the 6-digit verification code.');
    }

    const attemptsKey = 'cust:otp:attempts:' + rawEmail;
    const [attempts] = await pipe([['INCR', attemptsKey], ['EXPIRE', attemptsKey, 300, 'NX']]);
    if (attempts > 5) {
      await cmd('DEL', 'cust:otp:' + rawEmail);
      throw new HttpError(429, 'Too many incorrect attempts. Please request a new code.');
    }

    const storedHash = await cmd('GET', 'cust:otp:' + rawEmail);
    if (!storedHash) {
      throw new HttpError(400, 'Code has expired or does not exist. Please request a new one.');
    }

    if (sha(otp) !== storedHash) {
      throw new HttpError(400, 'Invalid verification code. Please check your email.');
    }

    await pipe([
      ['DEL', 'cust:otp:' + rawEmail],
      ['DEL', attemptsKey]
    ]);

    const uid = 'email_' + sha(rawEmail).slice(0, 16);
    const displayName = text(b.name, 60) || rawEmail.split('@')[0];

    const user = await upsertCustomerUser({
      uid,
      email: rawEmail,
      name: displayName,
      phone: ''
    });

    const token = issueCustomerToken(user);
    setCustomerCookie(res, token);

    return res.json({ ok: true, user, message: 'Signed in successfully!' });
  }

  throw new HttpError(400, 'Invalid action. Use "send" or "verify".');
}

// -----------------------------------------------------------------------------
// 3. Google Auth Handler: /api/customer/google
// -----------------------------------------------------------------------------
async function handleGoogle(req, res) {
  if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
  const b = req.body || {};
  const credential = String(b.credential || '').trim();

  if (!credential) {
    throw new HttpError(400, 'Google credential token is required.');
  }

  const ip = clientIp(req);
  const rlKey = 'rl:googleauth:' + ip;
  const [count] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (count > 20) throw new HttpError(429, 'Too many requests. Please wait a moment.');

  let payload;
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) throw new Error('Bad JWT');
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (e) {
    throw new HttpError(400, 'Invalid Google credential token.');
  }

  if (!payload || !payload.sub || !payload.email) {
    throw new HttpError(400, 'Invalid Google account data.');
  }

  let verifiedEmail = payload.email;
  let verifiedName = payload.name || payload.email.split('@')[0];
  let verifiedPic = payload.picture || '';
  let sub = payload.sub;

  try {
    const googleRes = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), {
      signal: AbortSignal.timeout(3000)
    });
    if (googleRes.ok) {
      const gData = await googleRes.json();
      if (gData && gData.sub && gData.email) {
        sub = gData.sub;
        verifiedEmail = gData.email;
        verifiedName = gData.name || verifiedName;
        verifiedPic = gData.picture || verifiedPic;
      }
    }
  } catch (_) {}

  const uid = 'google_' + sub;
  const user = await upsertCustomerUser({
    uid,
    email: verifiedEmail,
    name: verifiedName,
    photoUrl: verifiedPic
  });

  const token = issueCustomerToken(user);
  setCustomerCookie(res, token);

  return res.json({ ok: true, user });
}

// -----------------------------------------------------------------------------
// Unified Router
// -----------------------------------------------------------------------------
module.exports = route(['GET', 'POST', 'DELETE'], async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const action = url.pathname.replace(/\/+$/, '').split('/').pop();

  if (action === 'session') return handleSession(req, res);
  if (action === 'otp') return handleOtp(req, res);
  if (action === 'google') return handleGoogle(req, res);

  throw new HttpError(404, 'Not found');
});
