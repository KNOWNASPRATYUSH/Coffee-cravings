const crypto = require('crypto');
'use strict';
// Menu, coupons, deals, customer database and sales statistics (all stored in Redis; the menu falls back to menu-data.js until the owner edits it).
const { cmd, pipe, HttpError, ORDER_TTL_S, toObj } = require('./_lib');
const DEFAULT_MENU = require('../menu-data.js');

const ist = (ts) => { const d = new Date(ts + 19800000); return { day: d.toISOString().slice(0, 10), hour: String(d.getUTCHours()).padStart(2, '0') }; };
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>"`\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
const cleanPhone = (v) => String(v || '').replace(/[^0-9]/g, '').slice(-15);
const isPhone = (v) => {
  if (typeof v !== 'string' && typeof v !== 'number') return false;
  const s = String(v).trim();
  if (/[a-zA-Z_]/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
};

// ---------- menu ----------
async function loadMenu() {
  const m = parse(await cmd('GET', 'menu:v1'));
  if (!Array.isArray(m) || !m.length) {
    return DEFAULT_MENU.map(i => ({ ...i, available: true }));
  }
  const existingMap = new Map(m.map(i => [i.id, i]));
  const merged = DEFAULT_MENU.map(def => {
    const ex = existingMap.get(def.id);
    if (!ex) return { ...def, available: true };
    return { ...def, available: ex.available !== false };
  });
  for (const item of m) {
    if (item && item.id && !DEFAULT_MENU.some(d => d.id === item.id)) {
      merged.push(item);
    }
  }
  return merged;
}
const publicItem = (i) => ({ id: i.id, name: i.name, category: i.category, categoryName: i.categoryName, price: i.price,
  description: i.description, image: i.image, badge: i.badge || '', featured: !!i.featured });
const saveMenu = (menu) => cmd('SET', 'menu:v1', JSON.stringify(menu));

function cleanItem(raw, menu) {
  const name = text(raw.name, 60);
  if (!name) throw new HttpError(400, 'Product name is required.');
  const price = Number(raw.price);
  if (!(price > 0 && price <= 100000) || Math.abs(price * 100 - Math.round(price * 100)) > 1e-6) throw new HttpError(400, 'Enter a valid price (up to 2 decimals).');
  const category = String(raw.category || '').toLowerCase().trim();
  if (!/^[a-z0-9-]{2,24}$/.test(category)) throw new HttpError(400, 'Category must be 2-24 letters/numbers (e.g. desserts).');
  const sameCat = menu.find(m => m.category === category);
  const categoryName = text(raw.categoryName, 40) || (sameCat && sameCat.categoryName) || category;
  const image = String(raw.image || '').trim();
  if (image && !/^https:\/\/[^\s"'<>`\\]{4,400}$/.test(image)) throw new HttpError(400, 'Image must be a valid https:// link.');
  return { name, price: Math.round(price * 100) / 100, category, categoryName, description: text(raw.description, 200), image,
    badge: text(raw.badge, 20), featured: !!raw.featured, available: raw.available !== false };
}
function upsertItem(menu, raw) {
  const fields = cleanItem(raw, menu);
  if (raw.id) {
    const i = menu.findIndex(m => m.id === raw.id);
    if (i < 0) throw new HttpError(404, 'Product not found.');
    menu[i] = { ...menu[i], ...fields };
    return menu[i];
  }
  if (menu.length >= 150) throw new HttpError(400, 'Menu is full (150 products).');
  const base = fields.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
  let id = base, n = 2; while (menu.some(m => m.id === id)) id = base + '-' + n++;
  const item = { id, ...fields }; menu.push(item); return item;
}

// ---------- deals (Buy X Get Y Free) ----------
async function loadDeals() {
  const all = Object.values(toObj(await cmd('HGETALL', 'deals'))).map(parse).filter(Boolean);
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

function cleanDeal(raw, menu) {
  const name = text(raw.name, 80);
  if (!name) throw new HttpError(400, 'Deal name is required.');
  const buyItemId = String(raw.buyItemId || '').trim();
  const buyQty = Math.floor(Number(raw.buyQty));
  if (!menu.some(m => m.id === buyItemId)) throw new HttpError(400, 'Selected "Buy" product is not in the menu.');
  if (!(buyQty >= 1 && buyQty <= 50)) throw new HttpError(400, 'Buy quantity must be between 1 and 50.');
  
  const freeItemId = String(raw.freeItemId || '').trim();
  const freeQty = Math.floor(Number(raw.freeQty));
  if (!menu.some(m => m.id === freeItemId)) throw new HttpError(400, 'Selected "Free" product is not in the menu.');
  if (!(freeQty >= 1 && freeQty <= 20)) throw new HttpError(400, 'Free quantity must be between 1 and 20.');

  const id = raw.id ? String(raw.id).trim() : 'deal-' + Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
  return { id, name, buyItemId, buyQty, freeItemId, freeQty, active: raw.active !== false };
}

const publicDeal = (d) => ({
  id: d.id, name: d.name, buyItemId: d.buyItemId, buyQty: d.buyQty, freeItemId: d.freeItemId, freeQty: d.freeQty
});

function applyDealsToCart(rawItems, liveMap, deals) {
  const requested = new Map();
  for (const it of rawItems) {
    if (it && it.id && it.qty > 0) requested.set(it.id, (requested.get(it.id) || 0) + it.qty);
  }

  const freebies = [];
  for (const deal of (deals || []).filter(d => d.active !== false)) {
    const bought = requested.get(deal.buyItemId) || 0;
    if (bought < deal.buyQty) continue;

    if (deal.buyItemId === deal.freeItemId) {
      // Same item BOGO (e.g. Buy 2 Get 1 Free on Cappuccino)
      const cycle = deal.buyQty + deal.freeQty;
      const fullCycles = Math.floor(bought / cycle);
      const remainder = bought % cycle;
      let freeCount = fullCycles * deal.freeQty;
      let paidCount = fullCycles * deal.buyQty;
      if (remainder >= deal.buyQty) {
        paidCount += remainder;
        freeCount += Math.floor(remainder / deal.buyQty) * deal.freeQty;
      } else {
        paidCount += remainder;
      }
      requested.set(deal.buyItemId, paidCount);
      const m = liveMap.get(deal.freeItemId);
      if (m && freeCount > 0) {
        freebies.push({
          id: m.id,
          name: `${m.name} (Free · ${deal.name})`,
          qty: freeCount,
          price: 0,
          isFree: true,
          dealId: deal.id
        });
      }
    } else {
      // Different item (e.g. Buy 2 Cappuccinos, Get 1 Croissant free)
      const times = Math.floor(bought / deal.buyQty);
      const totalFree = times * deal.freeQty;
      const existingInCart = requested.get(deal.freeItemId) || 0;
      const freeFromCart = Math.min(existingInCart, totalFree);
      if (freeFromCart > 0) {
        requested.set(deal.freeItemId, existingInCart - freeFromCart);
      }
      const m = liveMap.get(deal.freeItemId);
      if (m && totalFree > 0) {
        freebies.push({
          id: m.id,
          name: `${m.name} (Free · ${deal.name})`,
          qty: totalFree,
          price: 0,
          isFree: true,
          dealId: deal.id
        });
      }
    }
  }

  const finalItems = [];
  for (const [id, qty] of requested) {
    if (qty > 0) {
      const m = liveMap.get(id);
      if (m) finalItems.push({ id, name: m.name, qty, price: m.price });
    }
  }
  for (const fb of freebies) finalItems.push(fb);
  return { items: finalItems, freebies };
}

// ---------- coupons ----------
const cleanCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
function cleanCoupon(raw) {
  const code = cleanCode(raw.code);
  if (code.length < 3) throw new HttpError(400, 'Coupon code must be 3-20 letters/numbers.');
  const type = raw.type === 'flat' ? 'flat' : 'percent';
  const value = Number(raw.value);
  if (type === 'percent' ? !(Number.isInteger(value) && value >= 1 && value <= 100) : !(value >= 1 && value <= 100000)) throw new HttpError(400, type === 'percent' ? 'Percent must be a whole number from 1 to 100.' : 'Flat amount must be between 1 and 100000.');
  const num = (v, max, label) => { const n = Number(v || 0); if (!(n >= 0 && n <= max)) throw new HttpError(400, label + ' is invalid.'); return n; };
  const expiresAt = String(raw.expiresAt || '');
  if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) throw new HttpError(400, 'Expiry date is invalid.');
  return { code, type, value, minOrder: num(raw.minOrder, 100000, 'Minimum order'), maxDiscount: type === 'percent' ? num(raw.maxDiscount, 100000, 'Max discount') : 0,
    maxUses: Math.floor(num(raw.maxUses, 1000000, 'Max uses')), expiresAt, active: raw.active !== false, newCustomerOnly: !!raw.newCustomerOnly,
    perCustomerLimit: raw.perCustomerLimit !== undefined ? Math.floor(num(raw.perCustomerLimit, 1000, 'Per-customer limit')) : (raw.newCustomerOnly ? 1 : 0) };
}
const discountOf = (c, subtotalP) => {
  let d = c.type === 'percent' ? Math.floor(subtotalP * c.value / 100) : Math.round(c.value * 100);
  if (c.type === 'percent' && c.maxDiscount > 0) d = Math.min(d, Math.round(c.maxDiscount * 100));
  return Math.min(d, subtotalP);
};
// subtotalP = null -> only check that the code itself is usable (used by the "Apply" button)
async function checkCoupon(code, subtotalP, rawPhone, customerUid = '') {
  const c = parse(await cmd('HGET', 'coupons', code));
  if (!c || !c.active) throw new HttpError(400, 'This coupon code is not valid.');
  if (c.expiresAt && Date.now() > new Date(c.expiresAt + 'T23:59:59+05:30').getTime()) throw new HttpError(400, 'This coupon has expired.');
  if (c.maxUses > 0 && (parseInt(await cmd('GET', 'coupon:uses:' + code), 10) || 0) >= c.maxUses) throw new HttpError(400, 'This coupon has been fully redeemed.');
  if (subtotalP !== null && subtotalP < c.minOrder * 100) throw new HttpError(400, `Add items worth ₹${c.minOrder} or more to use this coupon.`);
  if (c.newCustomerOnly) {
    const phone = cleanPhone(rawPhone);
    if (!phone || phone.length < 6) throw new HttpError(400, 'Please enter your phone number to use this welcome coupon.');
    const cust = await lookupCustomer(phone);
    if (cust && (cust.orders > 0 || cust.paidOrders > 0)) {
      throw new HttpError(400, 'This welcome coupon is only valid for new customers on their first order.');
    }
    const alreadyUsed = await cmd('GET', 'coupon:welcome:used:' + phone);
    if (alreadyUsed) throw new HttpError(400, 'This welcome coupon has already been used for this number.');

    // Protect against account coupon-farming with alternate/fake phone numbers
    if (customerUid) {
      const uidUsed = await cmd('GET', 'coupon:welcome:used:uid:' + customerUid);
      if (uidUsed) throw new HttpError(400, 'This welcome coupon has already been used by your account.');
      const userProfile = await getCustomerUser(customerUid);
      if (userProfile && ((parseInt(userProfile.orders, 10) || 0) > 0 || (parseInt(userProfile.paidOrders, 10) || 0) > 0)) {
        throw new HttpError(400, 'This welcome coupon is only valid for new customers on their first order.');
      }
    }
  }

  // General Anti-Abuse Ruleset: Per-Customer Usage Limit Check for any coupon
  const limit = Number(c.perCustomerLimit || 0);
  if (limit > 0 && !c.newCustomerOnly) {
    const phone = cleanPhone(rawPhone);
    if (phone && phone.length >= 6) {
      const phoneUses = parseInt(await cmd('GET', 'coupon:useruses:' + code + ':' + phone), 10) || 0;
      if (phoneUses >= limit) {
        throw new HttpError(400, limit === 1 ? 'You have already used this coupon code.' : `You have reached the maximum limit (${limit} uses) for this coupon.`);
      }
    }
    if (customerUid) {
      const uidUses = parseInt(await cmd('GET', 'coupon:useruses:' + code + ':uid:' + customerUid), 10) || 0;
      if (uidUses >= limit) {
        throw new HttpError(400, limit === 1 ? 'You have already used this coupon code.' : `You have reached the maximum limit (${limit} uses) for this coupon.`);
      }
    }
  }

  return { coupon: c, discountP: subtotalP === null ? 0 : discountOf(c, subtotalP) };
}

// ---------- customer database & CRM ----------
async function lookupCustomer(rawPhone) {
  const phone = cleanPhone(rawPhone);
  if (!phone || phone.length < 6) return null;
  const raw = toObj(await cmd('HGETALL', 'customer:' + phone));
  if (!raw || !raw.phone) return { phone, exists: false, isNew: true, name: '', orders: 0, paidOrders: 0, totalSpend: 0 };
  return {
    phone, exists: true, isNew: (parseInt(raw.orders, 10) || 0) === 0,
    name: raw.name || '', orders: parseInt(raw.orders, 10) || 0,
    paidOrders: parseInt(raw.paidOrders, 10) || 0,
    totalSpend: Math.round(Number(raw.totalSpendP || 0)) / 100,
    firstSeen: raw.firstSeen || '', lastSeen: raw.lastSeen || ''
  };
}

async function recordCustomerOrder(phone, name, orderId, totalP, isPaid, orderDetails = null, customerUid = '') {
  const p = cleanPhone(phone);
  if (!p && !customerUid) return;
  const now = new Date().toISOString();

  // Full permanent order receipt
  const receipt = {
    id: orderId,
    at: now,
    total: totalP / 100,
    isPaid: !!isPaid,
    ...(orderDetails ? {
      items: orderDetails.items || [],
      subtotal: orderDetails.subtotal,
      discount: orderDetails.discount,
      couponCode: orderDetails.couponCode,
      tax: orderDetails.tax,
      table: orderDetails.table,
      paymentMethod: orderDetails.paymentMethod,
      dealsApplied: orderDetails.dealsApplied
    } : {})
  };
  const receiptStr = JSON.stringify(receipt);

  const c = [];
  if (p && p.length >= 6) {
    const key = 'customer:' + p;
    const existing = toObj(await cmd('HGETALL', key));
    const firstSeen = existing.firstSeen || now;
    c.push(
      ['HSET', key, 'phone', p, 'name', text(name, 60) || existing.name || 'Guest', 'lastSeen', now, 'firstSeen', firstSeen],
      ['HINCRBY', key, 'orders', 1],
      ['ZADD', 'customers', Date.now(), p],
      ['HSET', 'cust:orders:' + p, orderId, receiptStr]
    );
    if (isPaid) {
      c.push(['HINCRBY', key, 'paidOrders', 1], ['HINCRBY', key, 'totalSpendP', totalP]);
    }
    if (customerUid) {
      c.push(
        ['SET', 'cust:phone2uid:' + p, customerUid],
        ['SET', 'cust:uid2phone:' + customerUid, p]
      );
    }
  }

  if (customerUid) {
    const ukey = 'cust:user:' + customerUid;
    c.push(
      ['HINCRBY', ukey, 'orders', 1],
      ['HSET', 'cust:orders:uid:' + customerUid, orderId, receiptStr]
    );
    if (isPaid) {
      c.push(['HINCRBY', ukey, 'paidOrders', 1], ['HINCRBY', ukey, 'totalSpendP', totalP]);
    }
  }

  if (c.length) await pipe(c);
}

async function recordCustomerPayment(phone, orderId, totalP) {
  const p = cleanPhone(phone);
  if (!p || p.length < 6) return;
  const key = 'customer:' + p;
  const c = [
    ['HINCRBY', key, 'paidOrders', 1],
    ['HINCRBY', key, 'totalSpendP', totalP]
  ];
  const orderRaw = await cmd('HGET', 'cust:orders:' + p, orderId);
  if (orderRaw) {
    const o = parse(orderRaw);
    if (o) { o.isPaid = true; c.push(['HSET', 'cust:orders:' + p, orderId, JSON.stringify(o)]); }
  }
  const uid = await cmd('GET', 'cust:phone2uid:' + p);
  if (uid) {
    const uidRaw = await cmd('HGET', 'cust:orders:uid:' + uid, orderId);
    if (uidRaw) {
      const uo = parse(uidRaw);
      if (uo) { uo.isPaid = true; c.push(['HSET', 'cust:orders:uid:' + uid, orderId, JSON.stringify(uo)]); }
    }
  }
  await pipe(c);
}

async function listCustomers(start = 0, stop = 99) {
  const phones = await cmd('ZREVRANGE', 'customers', start, stop);
  if (!phones || !phones.length) return [];
  const rows = await pipe(phones.map(p => ['HGETALL', 'customer:' + p]));
  return rows.map(toObj).map(raw => ({
    phone: raw.phone, name: raw.name || 'Guest',
    orders: parseInt(raw.orders, 10) || 0,
    paidOrders: parseInt(raw.paidOrders, 10) || 0,
    totalSpend: Math.round(Number(raw.totalSpendP || 0)) / 100,
    firstSeen: raw.firstSeen || '', lastSeen: raw.lastSeen || ''
  }));
}

async function getCustomerOrders(identifier, extraPhone = '') {
  if (!identifier && !extraPhone) return [];
  const rawMap = {};
  const phonesToCheck = new Set();
  const uidsToCheck = new Set();

  if (isPhone(identifier)) {
    phonesToCheck.add(cleanPhone(identifier));
  } else if (identifier && typeof identifier === 'string') {
    uidsToCheck.add(identifier.trim());
  }

  if (extraPhone && isPhone(extraPhone)) {
    phonesToCheck.add(cleanPhone(extraPhone));
  }

  for (const uid of uidsToCheck) {
    const uidMap = toObj(await cmd('HGETALL', 'cust:orders:uid:' + uid));
    Object.assign(rawMap, uidMap);

    const linkedPhone = await cmd('GET', 'cust:uid2phone:' + uid);
    if (linkedPhone && isPhone(linkedPhone)) phonesToCheck.add(cleanPhone(linkedPhone));

    const userProfile = toObj(await cmd('HGETALL', 'cust:user:' + uid));
    if (userProfile && userProfile.phone && isPhone(userProfile.phone)) {
      phonesToCheck.add(cleanPhone(userProfile.phone));
    }
  }

  for (const phone of phonesToCheck) {
    const phoneMap = toObj(await cmd('HGETALL', 'cust:orders:' + phone));
    Object.assign(rawMap, phoneMap);

    const linkedUid = await cmd('GET', 'cust:phone2uid:' + phone);
    if (linkedUid && !uidsToCheck.has(linkedUid)) {
      const uidOrders = toObj(await cmd('HGETALL', 'cust:orders:uid:' + linkedUid));
      Object.assign(rawMap, uidOrders);
    }
  }

  if (uidsToCheck.size > 0 && phonesToCheck.size > 0) {
    const firstUid = [...uidsToCheck][0];
    const firstPhone = [...phonesToCheck][0];
    await pipe([
      ['SET', 'cust:phone2uid:' + firstPhone, firstUid],
      ['SET', 'cust:uid2phone:' + firstUid, firstPhone],
      ['HSET', 'cust:user:' + firstUid, 'phone', firstPhone]
    ]);
  }

  return Object.values(rawMap).map(parse).filter(Boolean).sort((a, b) => new Date(b.at) - new Date(a.at));
}

function sanitizePhotoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!/^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s"'<>`\\]*)?$/.test(trimmed)) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    const allowed = [
      'googleusercontent.com',
      'images.unsplash.com',
      'res.cloudinary.com',
      'coffeeandcravings.shop',
      'www.coffeeandcravings.shop'
    ];
    if (!allowed.some(a => host === a || host.endsWith('.' + a))) return '';
    return parsed.href;
  } catch (e) {
    return '';
  }
}

async function upsertCustomerUser({ uid, email, phone, name, photoUrl }) {
  if (!uid) return null;
  const now = new Date().toISOString();
  const ukey = 'cust:user:' + uid;
  const existing = toObj(await cmd('HGETALL', ukey));
  const cleanP = cleanPhone(phone);
  const cleanE = String(email || '').trim().toLowerCase();
  const cleanN = text(name, 60) || existing.name || 'Coffee Lover';
  const cleanPhoto = sanitizePhotoUrl(photoUrl);

  const c = [
    ['HSET', ukey,
      'uid', uid,
      'name', cleanN,
      'email', cleanE || existing.email || '',
      'phone', cleanP || existing.phone || '',
      'photoUrl', cleanPhoto || existing.photoUrl || '',
      'lastSeen', now,
      'firstSeen', existing.firstSeen || now
    ],
    ['ZADD', 'customers:users', Date.now(), uid]
  ];
  if (cleanP && cleanP.length >= 6) {
    c.push(
      ['SET', 'cust:phone2uid:' + cleanP, uid],
      ['SET', 'cust:uid2phone:' + uid, cleanP]
    );
  }
  if (cleanE) {
    c.push(['SET', 'cust:email2uid:' + cleanE, uid]);
  }
  await pipe(c);
  return {
    uid,
    name: cleanN,
    email: cleanE || existing.email || '',
    phone: cleanP || existing.phone || '',
    photoUrl: cleanPhoto || existing.photoUrl || ''
  };
}

async function getCustomerUser(uid) {
  if (!uid) return null;
  const raw = toObj(await cmd('HGETALL', 'cust:user:' + uid));
  if (!raw || !raw.uid) return null;
  return {
    uid: raw.uid,
    name: raw.name || '',
    email: raw.email || '',
    phone: raw.phone || '',
    photoUrl: raw.photoUrl || '',
    firstSeen: raw.firstSeen || '',
    lastSeen: raw.lastSeen || ''
  };
}

async function recordCouponUsed(phone, code, orderId) {
  const p = cleanPhone(phone);
  if (!p || p.length < 6 || !code) return;
  await cmd('RPUSH', 'cust:coupons:' + p, JSON.stringify({ code, orderId, usedAt: new Date().toISOString() }));
}

async function getCustomerCoupons(phone) {
  const p = cleanPhone(phone);
  if (!p) return [];
  const raw = await cmd('LRANGE', 'cust:coupons:' + p, 0, 49);
  if (!Array.isArray(raw)) return [];
  return raw.map(parse).filter(Boolean).reverse(); // most-recent first
}


async function deleteCustomerData(uid, rawPhone) {
  const p = cleanPhone(rawPhone);
  const ops = [];
  if (uid) {
    ops.push(
      ['DEL', 'cust:user:' + uid],
      ['DEL', 'cust:orders:uid:' + uid],
      ['DEL', 'cust:uid2phone:' + uid]
    );
  }
  if (p) {
    ops.push(
      ['DEL', 'customer:' + p],
      ['DEL', 'cust:orders:' + p],
      ['DEL', 'cust:phone2uid:' + p],
      ['ZREM', 'customers', p]
    );
  }
  if (ops.length) await pipe(ops);
  return { ok: true };
}

// ---------- stats ----------
const bump = () => cmd('INCR', 'orders:rev'); // staff screens only re-download orders when this changes

// Counts a sale exactly once, at the moment an order becomes PAID.
async function recordSale(o) {
  if (!(await cmd('SET', 'sold:' + o.id, '1', 'NX', 'EX', ORDER_TTL_S))) return;
  const { day, hour } = ist(new Date(o.createdAt).getTime());
  const key = 'stats:' + day, P = (n) => Math.round(n * 100), m = o.paymentMethod === 'digital' ? 'digital' : 'counter';
  const c = [['HINCRBY', key, 'o', 1], ['HINCRBY', key, 'rev', P(o.total)], ['HINCRBY', key, 'sub', P(o.subtotal)], ['HINCRBY', key, 'disc', P(o.discount || 0)],
    ['HINCRBY', key, 'tax', P(o.tax)], ['HINCRBY', key, 'p_' + m, P(o.total)], ['HINCRBY', key, 'pc_' + m, 1],
    ['HINCRBY', key, 'h' + hour, P(o.total)], ['HINCRBY', key, 'ho' + hour, 1]];
  for (const i of o.items) c.push(['HINCRBY', key, 'q:' + i.id, i.qty], ['HINCRBY', key, 'r:' + i.id, P(i.price * i.qty)], ['HSET', key, 'n:' + i.id, i.name]);
  await pipe(c);
  if (o.phone) {
    await recordCustomerPayment(o.phone, o.id, P(o.total));
  }
}

// Reverses a previously recorded sale when an order is cancelled
async function voidSale(o) {
  const sold = await cmd('GET', 'sold:' + o.id);
  if (!sold) return;
  await cmd('DEL', 'sold:' + o.id);
  const { day, hour } = ist(new Date(o.createdAt).getTime());
  const key = 'stats:' + day, P = (n) => Math.round(n * 100), m = o.paymentMethod === 'digital' ? 'digital' : 'counter';
  const c = [
    ['HINCRBY', key, 'o', -1],
    ['HINCRBY', key, 'rev', -P(o.total)],
    ['HINCRBY', key, 'sub', -P(o.subtotal)],
    ['HINCRBY', key, 'disc', -P(o.discount || 0)],
    ['HINCRBY', key, 'tax', -P(o.tax)],
    ['HINCRBY', key, 'p_' + m, -P(o.total)],
    ['HINCRBY', key, 'pc_' + m, -1],
    ['HINCRBY', key, 'h' + hour, -P(o.total)],
    ['HINCRBY', key, 'ho' + hour, -1]
  ];
  for (const i of o.items) {
    c.push(['HINCRBY', key, 'q:' + i.id, -i.qty], ['HINCRBY', key, 'r:' + i.id, -P(i.price * i.qty)]);
  }
  await pipe(c);
}

module.exports = {
  ist, text, loadMenu, saveMenu, publicItem, upsertItem,
  loadDeals, cleanDeal, publicDeal, applyDealsToCart,
  cleanCoupon, cleanCode, checkCoupon,
  cleanPhone, isPhone, lookupCustomer, recordCustomerOrder, recordCustomerPayment, listCustomers, getCustomerOrders,
  recordCouponUsed, getCustomerCoupons,
  upsertCustomerUser, getCustomerUser, deleteCustomerData, sanitizePhotoUrl,
  bump, recordSale, voidSale
};
