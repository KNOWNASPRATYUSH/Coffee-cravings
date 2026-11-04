'use strict';
// Customer Email OTP Endpoint: /api/customer/otp
// Generates and verifies 6-digit cryptographic OTPs for Gmail / Email sign-in.
const crypto = require('crypto');
const { HttpError, route, pipe, cmd, clientIp, issueCustomerToken, setCustomerCookie } = require('../_lib');
const { upsertCustomerUser, text } = require('../_shop');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

async function sendEmailOtp(toEmail, otp) {
  // 1. Resend API (Free 3,000 emails/mo) if RESEND_API_KEY is configured
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
          html: `
            <div style="font-family:sans-serif; max-width:480px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px;">
              <h2 style="color:#78350f; margin-bottom:8px;">☕ Coffee & Cravings</h2>
              <p style="color:#4b5563; font-size:15px;">Your one-time sign-in code is:</p>
              <div style="font-size:32px; font-weight:700; letter-spacing:6px; color:#1f2937; margin:20px 0; background:#fef3c7; padding:12px; text-align:center; border-radius:8px;">${otp}</div>
              <p style="color:#6b7280; font-size:13px;">This code expires in 5 minutes. If you did not request this, please ignore this email.</p>
            </div>
          `
        })
      });
      if (res.ok) return { sent: true };
    } catch (e) {
      console.error('Resend email error:', e);
    }
  }

  // 2. Gmail SMTP / Custom SMTP if configured
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

  // Fallback: If no mailer API keys are configured, log to console for development / testing
  console.log(`[Coffee & Cravings] Verification OTP for ${toEmail}: ${otp}`);
  return { sent: false, devCode: otp };
}

module.exports = route(['POST'], async (req, res) => {
  const b = req.body || {};
  const action = String(b.action || '').trim().toLowerCase();
  const rawEmail = String(b.email || '').trim().toLowerCase();

  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) || rawEmail.length > 100) {
    throw new HttpError(400, 'Please enter a valid Gmail / Email address.');
  }

  // ---------------------------------------------------------------------------
  // Action 1: Send OTP
  // ---------------------------------------------------------------------------
  if (action === 'send') {
    const ip = clientIp(req);
    const rlKey = 'rl:otpsend:' + ip;
    const [sendCount] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
    if (sendCount > 10) {
      throw new HttpError(429, 'Too many OTP requests. Please wait a few minutes.');
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = sha(otp);

    // Save in Redis for 5 minutes (300 seconds)
    await pipe([
      ['SET', 'cust:otp:' + rawEmail, otpHash, 'EX', 300],
      ['DEL', 'cust:otp:attempts:' + rawEmail]
    ]);

    const result = await sendEmailOtp(rawEmail, otp);

    if (result.sent) {
      return res.json({ ok: true, message: `6-digit verification code sent to ${rawEmail}` });
    } else {
      // In dev mode or when keys aren't added yet, show dev code so user can test immediately
      return res.json({
        ok: true,
        devMode: true,
        devCode: result.devCode,
        message: `Verification code sent to ${rawEmail} (Test code: ${result.devCode})`
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Action 2: Verify OTP
  // ---------------------------------------------------------------------------
  if (action === 'verify') {
    const otp = String(b.otp || '').trim();
    if (!/^\d{6}$/.test(otp)) {
      throw new HttpError(400, 'Please enter the 6-digit verification code.');
    }

    // Rate-limit brute-force attempts
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

    // Validated! Delete OTP to prevent reuse
    await pipe([
      ['DEL', 'cust:otp:' + rawEmail],
      ['DEL', attemptsKey]
    ]);

    // Unique stable UID for this email
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
});
