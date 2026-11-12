'use strict';
const { HttpError, pipe, toObj, route, clientIp, cmd, customerOf } = require('./_lib');
const { lookupCustomer, cleanPhone, getCustomerCoupons } = require('./_shop');

const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };

module.exports = route(['GET'], async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const loggedCust = await customerOf(req);

  // Require customer session for private profile lookup
  if (!loggedCust) {
    throw new HttpError(401, 'Please sign in to view customer profile.');
  }

  const rawPhone = url.searchParams.get('phone') || (loggedCust ? loggedCust.phone : '');
  const phone = cleanPhone(rawPhone);

  if (!phone || phone.length < 6) {
    throw new HttpError(400, 'Valid phone number is required.');
  }

  // Cross-customer snooping prevention (fail closed)
  const userPhone = cleanPhone(loggedCust.phone);
  if (userPhone) {
    if (userPhone !== phone) {
      throw new HttpError(403, 'You can only view your own customer profile.');
    }
  } else {
    // Authenticated user has no verified phone on their session; check if this phone is linked to their account
    const phoneUid = await cmd('GET', 'cust:phone2uid:' + phone);
    if (!phoneUid || phoneUid !== loggedCust.uid) {
      throw new HttpError(403, 'You can only view your own customer profile.');
    }
  }

  const rlKey = 'rl:cust:' + clientIp(req);
  const [n] = await pipe([['INCR', rlKey], ['EXPIRE', rlKey, 600, 'NX']]);
  if (n > 40) throw new HttpError(429, 'Too many requests. Please wait a few minutes.');

  const cust = await lookupCustomer(phone);
  let welcomeCoupon = null;
  let couponsUsed = [];

  if (!cust || cust.isNew) {
    // Check if phone or account has already used a welcome coupon
    const usedPhone = await cmd('GET', 'coupon:welcome:used:' + phone);
    const usedUid = (loggedCust && loggedCust.uid) ? await cmd('GET', 'coupon:welcome:used:uid:' + loggedCust.uid) : null;
    if (!usedPhone && !usedUid) {
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

  // Never leak totalSpend to the public customer endpoint
  res.json({
    phone,
    exists: !!(cust && cust.exists),
    isNew: !cust || cust.isNew,
    name: (cust && cust.name) || (loggedCust && loggedCust.name) || '',
    orders: (cust && cust.orders) || 0,
    paidOrders: (cust && cust.paidOrders) || 0,
    welcomeCoupon,
    couponsUsed
  });
});
