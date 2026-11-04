'use strict';
// Public endpoint: GET /api/my-orders?phone=<phone>
// Returns the customer's recent orders with live status from Redis.
const { HttpError, cmd, pipe, toObj, route, clientIp } = require('./_lib');
const { cleanPhone, getCustomerOrders } = require('./_shop');

const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };

const STATUS_LABEL = {
  awaiting_payment: 'Awaiting Payment',
  new: 'Order Received',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  completed: 'Completed'
};

module.exports = route(['GET'], async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const phone = cleanPhone(url.searchParams.get('phone'));

  if (!phone || phone.length < 6) {
    throw new HttpError(400, 'Valid phone number is required.');
  }

  // Rate limit: 60 requests per 10 minutes per IP
  const rlKey = 'rl:myorders:' + clientIp(req);
  const [n] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (n > 60) throw new HttpError(429, 'Too many requests. Please wait a few minutes.');

  // Get the customer's stored order records
  const storedOrders = await getCustomerOrders(phone);
  if (!storedOrders.length) return res.json({ orders: [] });

  // Fetch live status for each order from order:<id> hash
  const liveResults = await pipe(storedOrders.map(o => ['HGETALL', 'order:' + o.id]));

  const orders = storedOrders.map((stored, i) => {
    const liveRaw = toObj(liveResults[i]);
    const liveData = liveRaw.data ? parse(liveRaw.data) : null;

    // If order has expired from Redis, use the stored snapshot
    const status = liveRaw.status || stored.status || 'completed';
    const paymentStatus = liveRaw.paymentStatus || (stored.isPaid ? 'PAID' : 'UNPAID');

    // Merge: live data takes priority; fall back to stored snapshot
    const items = (liveData && liveData.items) || stored.items || [];
    const total = stored.total || (liveData && liveData.total) || 0;
    const table = (liveData && liveData.table) || stored.table || 0;

    return {
      id: stored.id,
      status,
      statusLabel: STATUS_LABEL[status] || status,
      paymentStatus,
      total,
      items,
      table,
      createdAt: stored.at || (liveData && liveData.createdAt) || '',
      expired: !liveRaw.status // order key gone from Redis (> 48h)
    };
  }).filter(o => {
    // Show all non-expired orders, plus any completed/expired in the last 48h window
    if (!o.expired) return true;
    if (!o.createdAt) return false;
    return Date.now() - new Date(o.createdAt).getTime() < 48 * 60 * 60 * 1000;
  });

  res.json({ orders });
});
