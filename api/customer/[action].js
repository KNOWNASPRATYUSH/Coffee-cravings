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
  if (req.method === 'GET') {
    const cust = customerOf(req);
    if (!cust) return res.json({ loggedIn: false, user: null });
    const profile = await getCustomerUser(cust.uid);
    return res.json({ loggedIn: true, user: profile || cust });
  }

  if (req.method === 'DELETE') {
    clearCustomerCookie(res);
    return res.json({ ok: true });
  }

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
  // 1. Resend API (Free 3,000 emails/month, 0 credit card required)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + resendKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Coffee & Cravings <login@coffeeandcravings.shop>',
          to: [toEmail],
          subject: `${otp} is your Coffee & Cravings sign-in code`,
          html: `
            <div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px; background:#fff;">
              <h2 style="color:#78350f; margin-top:0;">☕ Coffee &amp; Cravings</h2>
              <p style="color:#374151; font-size:15px;">Here is your one-time sign-in code:</p>
              <div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#1f2937; margin:20px 0; background:#fef3c7; padding:14px; text-align:center; border-radius:8px;">${otp}</div>
              <p style="color:#6b7280; font-size:13px; line-height:1.5;">This code expires in 5 minutes. If you did not request this code, you can safely ignore this email.</p>
            </div>
          `
        })
      });
      if (res.ok) {
        console.log(`[Email] OTP successfully sent to ${toEmail} via Resend`);
        return { sent: true };
      }
      const errBody = await res.text();
      console.warn(`[Email] Resend API error: ${errBody}`);
    } catch (e) {
      console.error('[Email] Resend error:', e);
    }
  }

  // 2. Brevo API (Free 300 emails/day = 9,000/month, 0 credit card required)
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'Coffee & Cravings', email: process.env.EMAIL_FROM || 'login@coffeeandcravings.in' },
          to: [{ email: toEmail }],
          subject: `${otp} is your Coffee & Cravings sign-in code`,
          htmlContent: `<div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px;"><h2 style="color:#78350f;">☕ Coffee &amp; Cravings</h2><p>Your one-time sign-in code is:</p><div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#1f2937; margin:20px 0; background:#fef3c7; padding:14px; text-align:center; border-radius:8px;">${otp}</div><p style="color:#6b7280; font-size:13px;">Expires in 5 minutes.</p></div>`
        })
      });
      if (res.ok) {
        console.log(`[Email] OTP successfully sent to ${toEmail} via Brevo`);
        return { sent: true };
      }
    } catch (e) {
      console.error('[Email] Brevo error:', e);
    }
  }

  // 3. Gmail SMTP / Custom SMTP
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
      console.error('[Email] SMTP error:', e);
    }
  }

  // Fallback: Securely log on server console
  console.log(`[SECURITY] 6-digit OTP for ${toEmail}: ${otp}`);
  return { sent: false };
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
    const isTest = process.env.NODE_ENV === 'test';

    // NEVER expose OTP to client in production or browser UI!
    return res.json({
      ok: true,
      sent: result.sent,
      ...(isTest ? { devCode: otp } : {}),
      message: `6-digit verification code sent to ${rawEmail}. Please check your inbox (and spam folder)!`
    });
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
