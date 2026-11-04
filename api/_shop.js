'use strict';
// Menu, coupons and sales statistics (all stored in Redis; the menu falls back to menu-data.js until the owner edits it).
const { cmd, pipe, HttpError, ORDER_TTL_S } = require('./_lib');
const DEFAULT_MENU = require('../menu-data.js');

const ist = (ts) => { const d = new Date(ts + 19800000); return { day: d.toISOString().slice(0, 10), hour: String(d.getUTCHours()).padStart(2, '0') }; };
const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>"`\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };

// ---------- menu ----------
async function loadMenu() {
  const m = parse(await cmd('GET', 'menu:v1'));
  return Array.isArray(m) && m.length ? m : DEFAULT_MENU.map(i => ({ ...i, available: true }));
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
    maxUses: Math.floor(num(raw.maxUses, 1000000, 'Max uses')), expiresAt, active: raw.active !== false };
}
const discountOf = (c, subtotalP) => {
  let d = c.type === 'percent' ? Math.floor(subtotalP * c.value / 100) : Math.round(c.value * 100);
  if (c.type === 'percent' && c.maxDiscount > 0) d = Math.min(d, Math.round(c.maxDiscount * 100));
  return Math.min(d, subtotalP);
};
// subtotalP = null -> only check that the code itself is usable (used by the "Apply" button)
async function checkCoupon(code, subtotalP) {
  const c = parse(await cmd('HGET', 'coupons', code));
  if (!c || !c.active) throw new HttpError(400, 'This coupon code is not valid.');
  if (c.expiresAt && Date.now() > new Date(c.expiresAt + 'T23:59:59+05:30').getTime()) throw new HttpError(400, 'This coupon has expired.');
  if (c.maxUses > 0 && (parseInt(await cmd('GET', 'coupon:uses:' + code), 10) || 0) >= c.maxUses) throw new HttpError(400, 'This coupon has been fully redeemed.');
  if (subtotalP !== null && subtotalP < c.minOrder * 100) throw new HttpError(400, `Add items worth ₹${c.minOrder} or more to use this coupon.`);
  return { coupon: c, discountP: subtotalP === null ? 0 : discountOf(c, subtotalP) };
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
}
module.exports = { ist, text, loadMenu, saveMenu, publicItem, upsertItem, cleanCoupon, cleanCode, checkCoupon, bump, recordSale };
