'use strict';
const { HttpError, cmd, pipe, toObj, route, requireStaff, ORDER_TTL_S } = require('../_lib');
const { recordSale, bump } = require('../_shop');

const STATUSES = ['new', 'preparing', 'ready', 'completed', 'cancelled'];

module.exports = route(['GET', 'PATCH'], async (req, res) => {
  await requireStaff(req, ['barista', 'owner']);

  if (req.method === 'GET') {
    // cheap check first: 1 Redis command per poll unless something actually changed
    const rev = String((await cmd('GET', 'orders:rev')) || '0');
    if (new URL(req.url, 'http://x').searchParams.get('rev') === rev) return res.json({ unchanged: true, rev });
    await cmd('ZREMRANGEBYSCORE', 'orders', '-inf', Date.now() - ORDER_TTL_S * 1000);
    const ids = await cmd('ZREVRANGE', 'orders', 0, 99);
    const rows = ids.length ? await pipe(ids.map(id => ['HGETALL', 'order:' + id])) : [];
    const orders = rows.map(toObj).filter(o => o.data && o.status !== 'awaiting_payment').map(o => ({
      ...JSON.parse(o.data),
      status: o.status,
      paymentStatus: o.paymentStatus,
      cancelReason: o.cancelReason || null,
    }));
    return res.json({ orders, rev, serverTime: Date.now() });
  }

  const { id, status, paid, cancelReason } = req.body;
  if (!/^CC-\d{4,9}$/.test(String(id))) throw new HttpError(400, 'Invalid order.');
  if (status === undefined && paid !== true) throw new HttpError(400, 'Nothing to update.');
  if (status !== undefined && !STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.');
  const key = 'order:' + id;
  const f = toObj(await cmd('HGETALL', key));
  if (!f.data) throw new HttpError(404, 'Order not found (it may have expired).');
  if (f.status === 'awaiting_payment') throw new HttpError(409, 'This order is still waiting for the online payment.');
  const set = [];
  if (status !== undefined) set.push('status', status);
  if (paid === true) set.push('paymentStatus', 'PAID');
  if (status === 'cancelled' && cancelReason) {
    set.push('cancelReason', String(cancelReason).slice(0, 100));
  }
  await cmd('HSET', key, ...set);
  if (paid === true) await recordSale(JSON.parse(f.data));
  await bump();
  res.json({ ok: true });
});
