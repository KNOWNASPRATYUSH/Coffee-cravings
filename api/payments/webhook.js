'use strict';
// Source of truth for payments: the gateway calls this server-to-server, so an order is still marked
// PAID if the customer closes the tab or loses network right after paying.
const { HttpError, route } = require('../_lib');
const pay = require('../_pay');

async function rawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

const handler = route(['POST'], async (req, res) => {
  if (!pay.enabled()) throw new HttpError(404, 'Not found');
  const raw = await rawBody(req);
  if (!pay.sigOk(req.headers['x-razorpay-signature'], pay.hmacHex(pay.env().hook, raw))) throw new HttpError(400, 'Bad signature');

  let evt; try { evt = JSON.parse(raw.toString('utf8')); } catch (e) { throw new HttpError(400, 'Bad payload'); }
  const p = evt && evt.payload && evt.payload.payment && evt.payload.payment.entity;
  if (['payment.captured', 'order.paid'].includes(evt.event) && p && p.status === 'captured') {
    const id = await pay.markPaid(p.order_id, p.id, p.amount);
    if (!id) console.error('webhook: no matching order for', p.order_id);
  }
  res.json({ ok: true }); // always 2xx for a valid signature so the gateway doesn't retry forever
});
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
