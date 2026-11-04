'use strict';
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.OWNER_PIN = '123456';
process.env.BARISTA_PIN = '654321';
const assert = require('assert');
const orders = require('../api/orders'), config = require('../api/config'), session = require('../api/staff/session');
const ownerAction = require('../api/owner/[action]'), customerApi = require('../api/customer');

const call = async (h, { method = 'GET', body, cookie, url = '/', ip = '1.1.1.1', origin } = {}) => {
  const res = { code: 200, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; } };
  await h({ method, url, body, headers: { 'x-real-ip': ip, cookie: cookie || '', 'content-type': 'application/json', host: 'cafe.test', ...(origin ? { origin } : {}) } }, res);
  return res;
};

const login = async (pin, ip) => {
  const r = await call(session, { method: 'POST', body: { pin }, ip });
  return { r, cookie: (r.headers['Set-Cookie'] || '').split(';')[0] };
};

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('  ok  ' + name); };

(async () => {
  const owner = await login('123456', '5.5.5.1');

  // ---------- 1. Deals (Buy X Get Y Free) ----------
  await t('owner can create a Buy X Get Y free deal', async () => {
    const res = await call(ownerAction, {
      method: 'PUT', url: '/api/owner/deals', cookie: owner.cookie,
      body: { deal: { id: 'deal-bogo-fries', name: 'Buy 2 Cappuccinos Get Salted Fries Free', buyItemId: 'cappuccino', buyQty: 2, freeItemId: 'salted-french-fries', freeQty: 1, active: true } }
    });
    assert.equal(res.code, 200);
    const d = res.body.deals.find(x => x.id === 'deal-bogo-fries');
    assert(d, 'Deal should exist in deals list');
    assert.equal(d.buyQty, 2);
    assert.equal(d.freeItemId, 'salted-french-fries');
  });

  await t('customer ordering 2 Cappuccinos gets 1 free Salted Fries automatically', async () => {
    const r = await call(orders, {
      method: 'POST', ip: '5.5.5.2',
      body: { key: 'deal-test-key-1', table: 0, items: [{ id: 'cappuccino', qty: 2 }], customerName: 'Coffee Lover', phone: '9111111111', paymentMethod: 'counter' }
    });
    assert.equal(r.code, 201);
    const o = r.body.order;
    assert.equal(o.subtotal, 258); // 2 * 129
    const freeItem = o.items.find(i => i.id === 'salted-french-fries');
    assert(freeItem, 'Free fries should be in order items');
    assert.equal(freeItem.qty, 1);
    assert.equal(freeItem.price, 0);
  });

  await t('customer who adds both Cappuccinos and Fries gets the Fries for ₹0', async () => {
    const r = await call(orders, {
      method: 'POST', ip: '5.5.5.3',
      body: { key: 'deal-test-key-2', table: 0, items: [{ id: 'cappuccino', qty: 2 }, { id: 'salted-french-fries', qty: 1 }], customerName: 'Snack Fan', phone: '9222222222', paymentMethod: 'counter' }
    });
    assert.equal(r.code, 201);
    const o = r.body.order;
    // Subtotal should only be for the 2 Cappuccinos (258), fries are free!
    assert.equal(o.subtotal, 258);
    const fries = o.items.find(i => i.id === 'salted-french-fries');
    assert.equal(fries.price, 0);
  });

  await t('same item BOGO: Buy 1 Get 1 free on Americano', async () => {
    await call(ownerAction, {
      method: 'PUT', url: '/api/owner/deals', cookie: owner.cookie,
      body: { deal: { id: 'deal-bogo-americano', name: 'BOGO Americano', buyItemId: 'americano', buyQty: 1, freeItemId: 'americano', freeQty: 1, active: true } }
    });
    // Customer orders 1 Americano
    const r = await call(orders, {
      method: 'POST', ip: '5.5.5.4',
      body: { key: 'deal-test-key-3', table: 0, items: [{ id: 'americano', qty: 1 }], customerName: 'Americano Fan', phone: '9333333333', paymentMethod: 'counter' }
    });
    assert.equal(r.code, 201);
    const o = r.body.order;
    assert.equal(o.subtotal, 129); // paid for 1
    const totalAmericanos = o.items.filter(i => i.id === 'americano').reduce((s, i) => s + i.qty, 0);
    assert.equal(totalAmericanos, 2, 'Customer should receive 2 americanos (1 paid, 1 free)');
  });

  // ---------- 2. Customer Database & Welcome Coupon ----------
  await t('owner creates a Welcome Coupon for new customers only', async () => {
    const res = await call(ownerAction, {
      method: 'PUT', url: '/api/owner/coupons', cookie: owner.cookie,
      body: { coupon: { code: 'NEWBIE20', type: 'percent', value: 20, minOrder: 100, active: true, newCustomerOnly: true } }
    });
    assert.equal(res.code, 200);
    const c = res.body.coupons.find(x => x.code === 'NEWBIE20');
    assert(c, 'Coupon should be saved');
    assert.equal(c.newCustomerOnly, true);
  });

  await t('customer lookup returns isNew: true and active welcome coupon for new number', async () => {
    const r = await call(customerApi, { url: '/api/customer?phone=9888877777', ip: '5.5.5.5' });
    assert.equal(r.code, 200);
    assert.equal(r.body.isNew, true);
    assert(r.body.welcomeCoupon, 'Should suggest welcome coupon');
    assert.equal(r.body.welcomeCoupon.code, 'NEWBIE20');
  });

  await t('new customer without phone number cannot use welcome coupon', async () => {
    const r = await call(orders, {
      method: 'POST', ip: '5.5.5.6',
      body: { key: 'cust-test-01', table: 0, items: [{ id: 'cappuccino', qty: 2 }], coupon: 'NEWBIE20', phone: '' }
    });
    assert.equal(r.code, 400);
    assert(/phone number/i.test(r.body.error));
  });

  await t('new customer places their first order with NEWBIE20 successfully', async () => {
    const r = await call(orders, {
      method: 'POST', ip: '5.5.5.7',
      body: { key: 'cust-test-02', table: 0, items: [{ id: 'cappuccino', qty: 2 }], coupon: 'NEWBIE20', phone: '9888877777', customerName: 'Priya' }
    });
    assert.equal(r.code, 201);
    assert.equal(r.body.order.couponCode, 'NEWBIE20');
    assert(r.body.order.discount > 0);
  });

  await t('same customer trying to use NEWBIE20 again is rejected', async () => {
    const r = await call(orders, {
      method: 'POST', ip: '5.5.5.8',
      body: { key: 'cust-test-03', table: 0, items: [{ id: 'cappuccino', qty: 2 }], coupon: 'NEWBIE20', phone: '9888877777', customerName: 'Priya' }
    });
    assert.equal(r.code, 400);
    assert(/welcome coupon/i.test(r.body.error));
  });

  await t('returning customer lookup shows isNew: false and order count', async () => {
    const r = await call(customerApi, { url: '/api/customer?phone=9888877777', ip: '5.5.5.9' });
    assert.equal(r.code, 200);
    assert.equal(r.body.isNew, false);
    assert.equal(r.body.name, 'Priya');
    assert.equal(r.body.orders, 1);
    assert.equal(r.body.welcomeCoupon, null);
  });

  await t('owner customer database shows registered customers and order history', async () => {
    const list = await call(ownerAction, { url: '/api/owner/customers', cookie: owner.cookie });
    assert.equal(list.code, 200);
    assert(list.body.customers.length >= 1);
    const priya = list.body.customers.find(c => c.phone === '9888877777');
    assert(priya, 'Priya should be in customer database');
    assert.equal(priya.name, 'Priya');

    // Customer details and order history
    const detail = await call(ownerAction, { url: '/api/owner/customers?phone=9888877777', cookie: owner.cookie });
    assert.equal(detail.code, 200);
    assert.equal(detail.body.customer.name, 'Priya');
    assert(detail.body.orders.length >= 1, 'Should list orders placed by customer');
  });

  console.log(`\n${n} CRM & Deals checks passed!`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
