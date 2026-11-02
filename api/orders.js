'use strict';
const { HttpError, cmd, pipe, toObj, route, menuMap, clientIp, tableSigOk, MAX_TABLE, ORDER_TTL_S } = require('./_lib');
const pay = require('./_pay');

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Public endpoint used by the customer site. Prices always come from the server-side menu.
module.exports = route(['POST'], async (req, res) => {
  const b = req.body;

  const rlKey = 'rl:order:' + clientIp(req);
  const [n] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (n > 8) throw new HttpError(429, 'Too many orders from this device. Please wait a few minutes.');

  const key = String(b.key || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(key)) throw new HttpError(400, 'Invalid request.');

  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 40) throw new HttpError(400, 'Your cart is empty.');
  const merged = new Map();
  for (const it of b.items) {
    const m = menuMap.get(it && it.id);
    const qty = Number(it && it.qty);
    if (!m || !Number.isInteger(qty) || qty < 1 || qty > 20) throw new HttpError(400, 'Some items in your cart are no longer available. Please refresh.');
    merged.set(m.id, (merged.get(m.id) || 0) + qty);
  }
  const items = [...merged].map(([id, qty]) => ({ id, name: menuMap.get(id).name, qty, price: menuMap.get(id).price }));
  if (items.reduce((s, i) => s + i.qty, 0) > 60) throw new HttpError(400, 'Too many items in one order.');

  const table = b.table === undefined || b.table === null || b.table === '' ? 0 : Number(b.table);
  if (!Number.isInteger(table) || table < 0 || table > MAX_TABLE) throw new HttpError(400, 'Invalid table.');
  if (table > 0 && !tableSigOk(table, b.sig)) throw new HttpError(400, 'Please scan the QR code on your table to order for a table, or order as takeaway.');

  const phone = clean(b.phone, 15);
  if (phone && !/^[0-9+\- ]{6,15}$/.test(phone)) throw new HttpError(400, 'Please enter a valid phone number.');

  // idempotency: the same checkout can never create two orders (double tap / retry)
  const idem = 'idem:' + key;
  const claimed = await cmd('SET', idem, 'pending', 'NX', 'EX', 600);
  if (!claimed) {
    const prev = await cmd('GET', idem);
    if (prev && prev !== 'pending') {
      const f = toObj(await cmd('HGETALL', 'order:' + prev));
      if (f.data) {
        const order = { ...JSON.parse(f.data), status: f.status, paymentStatus: f.paymentStatus };
        const payment = f.status === 'awaiting_payment' ? { gateway: 'razorpay', keyId: pay.keyId(), orderId: f.gatewayOrderId, amount: Number(f.amount), currency: 'INR' } : null;
        return res.status(200).json({ order, payment });
      }
    }
    throw new HttpError(409, 'Your order is already being placed.');
  }

  try {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = Math.round(subtotal * 5) / 100;
    const seq = await cmd('INCR', 'seq:order');
    const order = {
      id: 'CC-' + (1000 + seq), table, customerName: clean(b.customerName, 60) || 'Guest', phone,
      paymentMethod: b.paymentMethod === 'digital' ? 'digital' : 'counter', specialNotes: clean(b.specialNotes, 300),
      items, subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100, createdAt: new Date().toISOString()
    };
    const online = order.paymentMethod === 'digital' && pay.enabled();
    // Online orders stay hidden from the barista (awaiting_payment) until the gateway confirms the money.
    const out = { ...order, status: online ? 'awaiting_payment' : 'new', paymentStatus: online ? 'PENDING' : 'UNPAID' };
    const ok = 'order:' + order.id;
    const writes = [
      ['HSET', ok, 'data', JSON.stringify(out), 'status', out.status, 'paymentStatus', out.paymentStatus],
      ['EXPIRE', ok, ORDER_TTL_S],
      ['ZADD', 'orders', Date.now(), order.id],
      ['SET', idem, order.id, 'EX', 86400]
    ];
    let payment = null;
    if (online) {
      const amount = Math.round(order.total * 100);
      const g = await pay.createGatewayOrder(amount, order.id);
      payment = { gateway: 'razorpay', keyId: pay.keyId(), orderId: g.id, amount, currency: 'INR' };
      writes.push(['HSET', ok, 'gatewayOrderId', g.id, 'amount', amount], ['SET', 'rzp:' + g.id, order.id, 'EX', ORDER_TTL_S]);
    }
    await pipe(writes);
    res.status(201).json({ order: out, payment });
  } catch (e) {
    await cmd('DEL', idem).catch(() => {});
    throw e;
  }
});
