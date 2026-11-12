'use strict';
// Razorpay adapter. Active only when all three RAZORPAY_* env vars are set; otherwise the site keeps the
// manual flow (UPI order arrives UNPAID and the barista confirms it).
const crypto = require('crypto');
const { cmd, toObj, HttpError } = require('./_lib');
const { recordSale, bump } = require('./_shop');

const env = () => ({ id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET, hook: process.env.RAZORPAY_WEBHOOK_SECRET });
const enabled = () => { const e = env(); return !!(e.id && e.secret && e.hook); };
const keyId = () => env().id;
const hmacHex = (key, data) => crypto.createHmac('sha256', key).update(data).digest('hex');
const sigOk = (given, expected) => typeof given === 'string' && given.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));

async function createGatewayOrder(amountPaise, receipt) {
  const e = env();
  let r;
  try {
    r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(e.id + ':' + e.secret).toString('base64') },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt })
    });
  } catch (err) { console.error('razorpay unreachable', err.message); }
  if (!r || !r.ok) {
    if (r) console.error('razorpay order failed', r.status, await r.text().catch(() => ''));
    throw new HttpError(502, 'Online payment is unavailable right now. Please choose Pay at Counter or try again.');
  }
  return r.json();
}

// The ONLY place an online order becomes PAID and reaches the barista. Safe to call many times
// (checkout callback + webhook both call it). Amount must match what we asked the gateway to collect.
async function markPaid(gatewayOrderId, paymentId, amountPaise) {
  const ours = await cmd('GET', 'rzp:' + gatewayOrderId);
  if (!ours) return null;
  const key = 'order:' + ours;
  const f = toObj(await cmd('HGETALL', key));
  if (!f.data) return null;
  if (amountPaise != null && Number(f.amount) !== Number(amountPaise)) { console.error('payment amount mismatch for', ours); return null; }
  if (f.status === 'awaiting_payment') {
    await cmd('HSET', key, 'status', 'new', 'paymentStatus', 'PAID', 'paymentRef', String(paymentId || ''));
    await recordSale(JSON.parse(f.data));
    await bump();
  }
  return ours;
}
async function fetchGatewayPayment(paymentId) {
  const { id, secret } = env();
  if (!id || !secret || !paymentId) return null;
  try {
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64')
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

module.exports = { enabled, keyId, env, hmacHex, sigOk, createGatewayOrder, markPaid, fetchGatewayPayment };
