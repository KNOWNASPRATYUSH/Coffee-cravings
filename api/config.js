'use strict';
const { HttpError, pipe, route, clientIp } = require('./_lib');
const { loadMenu, publicItem, cleanCode, checkCoupon } = require('./_shop');
const pay = require('./_pay');

// Public: live menu + whether online payment is on; or (?coupon=CODE) the rule of a usable coupon.
module.exports = route(['GET'], async (req, res) => {
  const code = cleanCode(new URL(req.url, 'http://x').searchParams.get('coupon'));
  if (code) {
    const key = 'rl:coupon:' + clientIp(req);
    const [n] = await pipe([['INCR', key], ['EXPIRE', key, 600, 'NX']]);
    if (n > 20) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
    const { coupon: c } = await checkCoupon(code, null);
    return res.json({ coupon: { code: c.code, type: c.type, value: c.value, minOrder: c.minOrder, maxDiscount: c.maxDiscount } });
  }
  const menu = await loadMenu();
  res.json({ gateway: pay.enabled(), menu: menu.filter(m => m.available !== false).map(publicItem) });
});
