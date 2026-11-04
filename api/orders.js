'use strict';
const { HttpError, cmd, pipe, toObj, route, clientIp, tableSigOk, customerOf, MAX_TABLE, ORDER_TTL_S } = require('./_lib');
const { text, loadMenu, loadDeals, applyDealsToCart, cleanCode, checkCoupon, cleanPhone, recordCustomerOrder, recordCouponUsed, bump } = require('./_shop');
const pay = require('./_pay');

// Public endpoint used by the customer site. Prices, availability and discounts are always decided here, never by the browser.
module.exports = route(['POST'], async (req, res) => {
  const b = req.body;

  const rlKey = 'rl:order:' + clientIp(req);
  const [n] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (n > 8) throw new HttpError(429, 'Too many orders from this device. Please wait a few minutes.');

  const key = String(b.key || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(key)) throw new HttpError(400, 'Invalid request.');

  const menu = await loadMenu();
  const live = new Map(menu.filter(m => m.available !== false).map(m => [m.id, m]));
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 40) throw new HttpError(400, 'Your cart is empty.');

  // Validate items requested
  for (const it of b.items) {
    const m = live.get(it && it.id);
    const qty = Number(it && it.qty);
    if (!m || !Number.isInteger(qty) || qty < 1 || qty > 20) throw new HttpError(400, 'Some items in your cart are no longer available. Please refresh the page.');
  }

  // Apply Buy X Get Y Deals (BOGO / Free items)
  const deals = await loadDeals();
  const { items, freebies } = applyDealsToCart(b.items, live, deals);

  if (items.reduce((s, i) => s + i.qty, 0) > 60) throw new HttpError(400, 'Too many items in one order.');

  const table = b.table === undefined || b.table === null || b.table === '' ? 0 : Number(b.table);
  if (!Number.isInteger(table) || table < 0 || table > MAX_TABLE) throw new HttpError(400, 'Invalid table.');
  if (table > 0 && !tableSigOk(table, b.sig)) throw new HttpError(400, 'Please scan the QR code on your table to order for a table, or order as takeaway.');

  const loggedCust = customerOf(req);

  const phone = text(b.phone || (loggedCust ? loggedCust.phone : ''), 15);
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
    const P = (v) => Math.round(v * 100); // all money maths in paise
    const subtotalP = items.reduce((s, i) => s + P(i.price) * i.qty, 0);
    let discountP = 0, couponCode = '', isNewCustCoupon = false;
    const code = cleanCode(b.coupon);
    if (code) {
      const checkRes = await checkCoupon(code, subtotalP, phone);
      discountP = checkRes.discountP;
      couponCode = code;
      isNewCustCoupon = !!checkRes.coupon.newCustomerOnly;
    }
    const taxP = Math.round((subtotalP - discountP) * 5 / 100); // GST on the discounted amount
    const totalP = subtotalP - discountP + taxP;

    const seq = await cmd('INCR', 'seq:order');
    const custName = text(b.customerName, 60) || (loggedCust ? loggedCust.name : '') || 'Guest';
    const order = {
      id: 'CC-' + (1000 + seq), table, customerName: custName, phone,
      paymentMethod: b.paymentMethod === 'digital' ? 'digital' : 'counter', specialNotes: text(b.specialNotes, 300),
      items, subtotal: subtotalP / 100, discount: discountP / 100, couponCode, tax: taxP / 100, total: totalP / 100,
      dealsApplied: freebies.map(f => f.dealId), createdAt: new Date().toISOString()
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
      const g = await pay.createGatewayOrder(totalP, order.id);
      payment = { gateway: 'razorpay', keyId: pay.keyId(), orderId: g.id, amount: totalP, currency: 'INR' };
      writes.push(['HSET', ok, 'gatewayOrderId', g.id, 'amount', totalP], ['SET', 'rzp:' + g.id, order.id, 'EX', ORDER_TTL_S]);
    }
    if (couponCode) writes.push(['INCR', 'coupon:uses:' + couponCode]);
    if (isNewCustCoupon && phone) {
      const p = cleanPhone(phone);
      if (p) writes.push(['SET', 'coupon:welcome:used:' + p, '1', 'EX', 365 * 86400]);
    }
    await pipe(writes);

    // Record customer order in customer database (with full permanent receipt)
    const custUid = loggedCust ? loggedCust.uid : '';
    if (phone || custUid) {
      await recordCustomerOrder(phone, order.customerName, order.id, totalP, false, order, custUid);
      if (couponCode && phone) await recordCouponUsed(phone, couponCode, order.id);
    }

    if (!online) await bump();
    res.status(201).json({ order: out, payment });
  } catch (e) {
    await cmd('DEL', idem).catch(() => {});
    throw e;
  }
});
