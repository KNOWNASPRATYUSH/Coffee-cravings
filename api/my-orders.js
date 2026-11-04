'use strict';
// Customer Orders endpoint: GET /api/my-orders
// Returns lifetime orders with live status from Redis when active,
// or the permanent stored receipt when older.
const { HttpError, pipe, toObj, route, clientIp, customerOf } = require('./_lib');
const { cleanPhone, isPhone, getCustomerOrders } = require('./_shop');

const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };

const STATUS_LABEL = {
  awaiting_payment: 'Awaiting Payment',
  new: 'Order Received',
  preparing: 'Preparing in Kitchen',
  ready: 'Ready for Pickup',
  completed: 'Completed'
};

module.exports = route(['GET'], async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const loggedCust = customerOf(req);
  const rawParamPhone = url.searchParams.get('phone') || '';
  const paramPhone = isPhone(rawParamPhone) ? cleanPhone(rawParamPhone) : '';
  const recentParam = String(url.searchParams.get('recent') || '').trim();

  // Primary identifier: authenticated UID or phone
  const identifier = (loggedCust && (loggedCust.uid || loggedCust.phone)) || paramPhone;

  if (!identifier && !paramPhone && !recentParam) {
    throw new HttpError(400, 'Valid phone number or login is required.');
  }

  // Rate limit: 60 requests per 10 minutes per IP
  const rlKey = 'rl:myorders:' + clientIp(req);
  const [n] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (n > 60) throw new HttpError(429, 'Too many requests. Please wait a few minutes.');

  // Get the customer's permanent order records (checking both UID and phone)
  const storedOrders = await getCustomerOrders(identifier, paramPhone);
  const orderMap = new Map();
  for (const o of storedOrders) {
    if (o && o.id) orderMap.set(o.id, o);
  }

  // Also check recent order IDs passed from browser localStorage
  if (recentParam) {
    const recentIds = recentParam.split(',').map(s => s.trim()).filter(s => /^CC-\d+$/i.test(s)).slice(0, 10);
    if (recentIds.length) {
      const activeRawList = await pipe(recentIds.map(id => ['HGETALL', 'order:' + id]));
      for (let i = 0; i < recentIds.length; i++) {
        const id = recentIds[i];
        if (!orderMap.has(id)) {
          const liveRaw = toObj(activeRawList[i]);
          if (liveRaw && (liveRaw.data || liveRaw.status)) {
            const liveData = liveRaw.data ? parse(liveRaw.data) : null;
            orderMap.set(id, {
              id,
              at: (liveData && liveData.createdAt) || new Date().toISOString(),
              total: liveData ? liveData.total : 0,
              subtotal: liveData ? liveData.subtotal : 0,
              discount: liveData ? liveData.discount : 0,
              tax: liveData ? liveData.tax : 0,
              items: liveData ? liveData.items : [],
              table: liveData ? liveData.table : 0,
              isPaid: liveRaw.paymentStatus === 'PAID',
              status: liveRaw.status || 'new',
              paymentStatus: liveRaw.paymentStatus || 'UNPAID'
            });
          }
        }
      }
    }
  }

  const combinedOrders = Array.from(orderMap.values()).sort((a, b) => new Date(b.at) - new Date(a.at));
  if (!combinedOrders.length) return res.json({ orders: [] });

  // Fetch live status for active orders from order:<id> hash
  const liveResults = await pipe(combinedOrders.map(o => ['HGETALL', 'order:' + o.id]));

  const orders = combinedOrders.map((stored, i) => {
    const liveRaw = toObj(liveResults[i]);
    const liveData = liveRaw.data ? parse(liveRaw.data) : null;

    // Live status takes precedence while order is in active queue (<48h);
    // when expired from active queue, defaults to 'completed'
    const status = liveRaw.status || stored.status || 'completed';
    const paymentStatus = liveRaw.paymentStatus || (stored.isPaid ? 'PAID' : 'UNPAID');

    // Items, subtotal, discount, tax: stored permanent receipt
    const items = (liveData && liveData.items && liveData.items.length) ? liveData.items : (stored.items || []);
    const total = stored.total || (liveData && liveData.total) || 0;
    const table = (liveData && liveData.table !== undefined) ? liveData.table : (stored.table || 0);

    return {
      id: stored.id,
      status,
      statusLabel: STATUS_LABEL[status] || status,
      paymentStatus,
      total,
      subtotal: stored.subtotal || total,
      discount: stored.discount || 0,
      tax: stored.tax || 0,
      items,
      table,
      createdAt: stored.at || (liveData && liveData.createdAt) || '',
      expired: !liveRaw.status // true when archived into lifetime history
    };
  });

  res.json({ orders });
});
