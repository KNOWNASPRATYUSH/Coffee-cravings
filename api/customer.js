'use strict';
const { HttpError, pipe, toObj, route, clientIp, cmd } = require('./_lib');
const { lookupCustomer, cleanPhone, getCustomerCoupons } = require('./_shop');

const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };

module.exports = route(['GET'], async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const rawPhone = url.searchParams.get('phone');
  const phone = cleanPhone(rawPhone);

  if (!phone || phone.length < 6) {
    throw new HttpError(400, 'Valid phone number is required.');
  }

  const rlKey = 'rl:cust:' + clientIp(req);
  const [n] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (n > 40) throw new HttpError(429, 'Too many requests. Please wait a few minutes.');

  const cust = await lookupCustomer(phone);
  let welcomeCoupon = null;
  let couponsUsed = [];

  if (!cust || cust.isNew) {
    // Check if phone has already used a welcome coupon
    const used = await cmd('GET', 'coupon:welcome:used:' + phone);
    if (!used) {
      // Find an active welcome coupon
      const allCoupons = Object.values(toObj(await cmd('HGETALL', 'coupons'))).map(parse).filter(Boolean);
      const activeWelcome = allCoupons.find(c => c.active && c.newCustomerOnly);
      if (activeWelcome) {
        welcomeCoupon = {
          code: activeWelcome.code,
          type: activeWelcome.type,
          value: activeWelcome.value,
          minOrder: activeWelcome.minOrder,
          maxDiscount: activeWelcome.maxDiscount
        };
      }
    }
  }

  if (cust && cust.exists) {
    couponsUsed = await getCustomerCoupons(phone);
  }

  res.json({
    phone,
    exists: !!(cust && cust.exists),
    isNew: !cust || cust.isNew,
    name: (cust && cust.name) || '',
    orders: (cust && cust.orders) || 0,
    paidOrders: (cust && cust.paidOrders) || 0,
    totalSpend: (cust && cust.totalSpend) || 0,
    welcomeCoupon,
    couponsUsed
  });
});

