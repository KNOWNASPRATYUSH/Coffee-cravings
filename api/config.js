'use strict';
const { HttpError, pipe, route, clientIp, customerOf } = require('./_lib');
const { loadMenu, publicItem, loadDeals, publicDeal, cleanCode, checkCoupon } = require('./_shop');
const pay = require('./_pay');

// Public: live menu + deals + whether online payment is on; or (?coupon=CODE&phone=...) the rule of a usable coupon.
module.exports = route(['GET'], async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const code = cleanCode(url.searchParams.get('coupon'));
  const phone = url.searchParams.get('phone') || '';

  if (code) {
    const key = 'rl:coupon:' + clientIp(req);
    const [n] = await pipe([['INCR', key], ['EXPIRE', key, 600, 'NX']]);
    if (n > 20) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
    const loggedCust = await customerOf(req);
    const { coupon: c } = await checkCoupon(code, null, phone, loggedCust ? loggedCust.uid : '');
    return res.json({ coupon: { code: c.code, type: c.type, value: c.value, minOrder: c.minOrder, maxDiscount: c.maxDiscount, newCustomerOnly: !!c.newCustomerOnly, perCustomerLimit: c.perCustomerLimit || 1 } });
  }

  const [menu, deals] = await Promise.all([loadMenu(), loadDeals()]);
  res.json({
    gateway: pay.enabled(),
    menu: menu.filter(m => m.available !== false).map(publicItem),
    deals: deals.filter(d => d.active !== false).map(publicDeal)
  });
});
