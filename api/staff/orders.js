'use strict';
const { HttpError, cmd, pipe, toObj, route, requireStaff, ORDER_TTL_S } = require('../_lib');

const STATUSES = ['new', 'preparing', 'ready', 'completed'];

module.exports = route(['GET', 'PATCH'], async (req, res) => {
  requireStaff(req, ['barista', 'owner']);

  if (req.method === 'GET') {
    await cmd('ZREMRANGEBYSCORE', 'orders', '-inf', Date.now() - ORDER_TTL_S * 1000);
    const ids = await cmd('ZREVRANGE', 'orders', 0, 99);
    const rows = ids.length ? await pipe(ids.map(id => ['HGETALL', 'order:' + id])) : [];
    const orders = rows.map(toObj).filter(o => o.data && o.status !== 'awaiting_payment').map(o => ({ ...JSON.parse(o.data), status: o.status, paymentStatus: o.paymentStatus }));
    return res.json({ orders, serverTime: Date.now() });
  }

  const { id, status, paid } = req.body;
  if (!/^CC-\d{4,9}$/.test(String(id))) throw new HttpError(400, 'Invalid order.');
  if (status === undefined && paid !== true) throw new HttpError(400, 'Nothing to update.');
  if (status !== undefined && !STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.');
  const key = 'order:' + id;
  if (!(await cmd('EXISTS', key))) throw new HttpError(404, 'Order not found (it may have expired).');
  const set = [];
  if (status !== undefined) set.push('status', status);
  if (paid === true) set.push('paymentStatus', 'PAID');
  await cmd('HSET', key, ...set);
  res.json({ ok: true });
});
