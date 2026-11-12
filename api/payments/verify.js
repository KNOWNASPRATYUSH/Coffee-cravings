'use strict';
// Called by the customer's browser right after the payment window reports success.
// A forged call fails: the signature can only be produced with the gateway secret.
const { HttpError, pipe, route, clientIp } = require('../_lib');
const pay = require('../_pay');

module.exports = route(['POST'], async (req, res) => {
  if (!pay.enabled()) throw new HttpError(404, 'Not found');
  const key = 'rl:verify:' + clientIp(req);
  const [n] = await pipe([['INCR', key], ['EXPIRE', key, 600, 'NX']]);
  if (n > 30) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');

  const { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: s } = req.body;
  if (![o, p].every(v => typeof v === 'string' && /^[A-Za-z0-9_]{6,40}$/.test(v))) throw new HttpError(400, 'Invalid request.');
  if (!pay.sigOk(s, pay.hmacHex(pay.env().secret, o + '|' + p))) throw new HttpError(400, 'Payment could not be verified.');

  let verifiedAmount = null;
  if (pay.env().id && pay.env().secret) {
    const payment = await pay.fetchGatewayPayment(p);
    if (payment) {
      if (!['captured', 'authorized'].includes(payment.status)) {
        throw new HttpError(400, 'Payment is not captured.');
      }
      if (payment.order_id && payment.order_id !== o) {
        throw new HttpError(400, 'Payment order mismatch.');
      }
      verifiedAmount = payment.amount;
    }
  }

  const orderId = await pay.markPaid(o, p, verifiedAmount);
  if (!orderId) throw new HttpError(404, 'Order not found.');
  res.json({ ok: true, orderId, paymentStatus: 'PAID' });
});
