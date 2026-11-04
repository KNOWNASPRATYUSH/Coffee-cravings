/* Owner-only screens: Reports, Menu manager, Coupons. Loaded by /staff; the API refuses anyone who is not the owner. */
'use strict';
const rs = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CARD = 'background:#fff; border:1px solid #e5e5e5; border-radius:8px; padding:16px;';
const SMALL_BTN = 'font-size:12px; padding:6px 12px;';
const INPUT = 'width:100%; padding:9px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;';
let reportDays = 7, lastReport = null, adminMenu = [], adminCoupons = [];

function openModal(html) {
  closeModal();
  const el = document.createElement('div');
  el.id = 'owner-modal';
  el.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9999; display:flex; align-items:flex-start; justify-content:center; overflow:auto; padding:20px 12px;';
  el.innerHTML = `<div style="${CARD} width:100%; max-width:520px; margin:auto;">${html}</div>`;
  document.body.appendChild(el);
}
function closeModal() { const el = document.getElementById('owner-modal'); if (el) el.remove(); }
const field = (label, inner) => `<label style="display:block; font-size:12px; color:#555; margin:10px 0 4px;">${label}</label>${inner}`;
const val = (id) => document.getElementById(id).value;
const checked = (id) => document.getElementById(id).checked;
const formError = (msg) => { const e = document.getElementById('om-error'); if (e) e.textContent = msg; };

/* ---------------- Reports ---------------- */
async function renderReports(view) {
  view.innerHTML = `<p class="story-text">Loading report…</p>`;
  try { lastReport = await api('/api/owner/report?days=' + reportDays); } catch (e) { if (role) view.innerHTML = `<p style="color:#b91c1c">${esc(e.message)}</p>`; return; }
  const r = lastReport, t = r.totals;
  const kpi = (label, value) => `<div style="${CARD}"><div style="font-size:12px; color:#666;">${label}</div><div style="font-size:24px; font-weight:600; margin-top:4px;">${value}</div></div>`;
  const bars = (data, key, label) => {
    const max = Math.max(...data.map(d => d[key]), 1);
    return `<div style="display:flex; align-items:flex-end; gap:3px; height:120px;">${data.map(d =>
      `<div title="${esc(label(d))}: ${esc(rs(d[key]))}" style="flex:1; min-width:3px; background:#3b2a20; border-radius:2px 2px 0 0; height:${Math.max(d[key] / max * 100, d[key] ? 3 : 0)}%;"></div>`).join('')}</div>`;
  };
  const pay = r.payments;
  view.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
      <div style="display:flex; gap:6px;">${[[1, 'Today'], [7, '7 days'], [30, '30 days']].map(([d, l]) =>
        `<button class="${reportDays === d ? 'btn-godaddy-dark' : 'btn-godaddy-outline'}" style="${SMALL_BTN}" onclick="reportDays=${d}; renderReports(document.getElementById('staff-view'))">${l}</button>`).join('')}</div>
      <button class="btn-godaddy-outline" style="${SMALL_BTN}" onclick="downloadReportCsv()">Download CSV</button>
    </div>
    <p style="font-size:12px; color:#777; margin:0 0 12px;">Only PAID orders are counted as sales. ${esc(r.from)}${r.from !== r.to ? ' to ' + esc(r.to) : ''} (IST).</p>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:14px;">
      ${kpi('Revenue (incl. GST)', rs(t.revenue))}${kpi('Paid orders', t.orders)}${kpi('Average order', rs(t.avgOrder))}${kpi('Discounts given', rs(t.discount))}${kpi('GST collected', rs(t.tax))}
    </div>
    ${r.days > 1 ? `<div style="${CARD} margin-bottom:14px;"><b style="font-size:14px;">Revenue per day</b><div style="margin-top:10px;">${bars(r.series, 'revenue', d => d.day)}</div></div>` : ''}
    <div style="${CARD} margin-bottom:14px;"><b style="font-size:14px;">Busy hours (revenue)</b><div style="margin-top:10px;">${bars(r.hours, 'revenue', h => h.hour + ':00')}</div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:#777; margin-top:4px;"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div></div>
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px;">
      <div style="${CARD}"><b style="font-size:14px;">Top items</b>
        ${r.items.length ? `<table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:8px;">${r.items.slice(0, 10).map(i =>
          `<tr><td style="padding:6px 0; border-top:1px solid #eee;">${esc(i.name)}</td><td style="text-align:right; border-top:1px solid #eee;">${i.qty} sold</td><td style="text-align:right; border-top:1px solid #eee;">${esc(rs(i.revenue))}</td></tr>`).join('')}</table>` : '<p style="font-size:13px; color:#777;">No sales in this period yet.</p>'}</div>
      <div style="${CARD}"><b style="font-size:14px;">Payment methods</b>
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:8px;">
          <tr><td style="padding:6px 0; border-top:1px solid #eee;">Online / UPI</td><td style="text-align:right; border-top:1px solid #eee;">${pay.digital.orders} orders</td><td style="text-align:right; border-top:1px solid #eee;">${esc(rs(pay.digital.revenue))}</td></tr>
          <tr><td style="padding:6px 0; border-top:1px solid #eee;">Pay at counter</td><td style="text-align:right; border-top:1px solid #eee;">${pay.counter.orders} orders</td><td style="text-align:right; border-top:1px solid #eee;">${esc(rs(pay.counter.revenue))}</td></tr></table></div>
    </div>`;
}
function downloadReportCsv() {
  if (!lastReport) return;
  const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const r = lastReport, rows = [['Sales report', r.from, r.to], [], ['Day', 'Paid orders', 'Revenue', 'Discounts']];
  r.series.forEach(d => rows.push([d.day, d.orders, d.revenue, d.discount]));
  rows.push([], ['Item', 'Qty sold', 'Revenue (before GST/discount)']);
  r.items.forEach(i => rows.push([i.name, i.qty, i.revenue]));
  rows.push([], ['Total revenue', r.totals.revenue], ['GST', r.totals.tax], ['Discounts', r.totals.discount], ['Orders', r.totals.orders]);
  const blob = new Blob(['\ufeff' + rows.map(x => x.map(q).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sales-${r.from}_to_${r.to}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------------- Menu manager ---------------- */
async function renderMenuAdmin(view) {
  view.innerHTML = `<p class="story-text">Loading menu…</p>`;
  try { adminMenu = (await api('/api/owner/menu')).menu; } catch (e) { if (role) view.innerHTML = `<p style="color:#b91c1c">${esc(e.message)}</p>`; return; }
  drawMenuAdmin(view);
}
function drawMenuAdmin(view) {
  view = view || document.getElementById('staff-view');
  view.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
      <span style="font-size:13px; color:#666;">${adminMenu.length} products. Hidden products disappear from the customer site immediately.</span>
      <button class="btn-godaddy-dark" style="${SMALL_BTN}" onclick="itemForm(-1)">+ Add product</button>
    </div>
    <div style="${CARD} padding:0; overflow:hidden;">${adminMenu.map((it, i) => `
      <div style="display:flex; gap:12px; align-items:center; padding:10px 14px; border-top:${i ? '1px solid #eee' : '0'}; opacity:${it.available === false ? .5 : 1}; flex-wrap:wrap;">
        <div style="width:44px; height:44px; border-radius:6px; background:#eee center/cover ${it.image ? `url('${esc(it.image)}')` : ''};"></div>
        <div style="flex:1; min-width:140px;"><div style="font-weight:600; font-size:14px;">${esc(it.name)}${it.available === false ? ' <span style="font-size:11px; color:#b91c1c;">(hidden)</span>' : ''}</div>
          <div style="font-size:12px; color:#777;">${esc(it.categoryName || it.category)}</div></div>
        <div style="font-weight:600;">${esc(rs(it.price))}</div>
        <div style="display:flex; gap:6px;">
          <button class="btn-godaddy-outline" style="${SMALL_BTN}" onclick="itemForm(${i})">Edit</button>
          <button class="btn-godaddy-outline" style="${SMALL_BTN}" onclick="toggleItem(${i})">${it.available === false ? 'Show' : 'Hide'}</button>
          <button class="btn-godaddy-outline" style="${SMALL_BTN} color:#b91c1c;" onclick="deleteItem(${i})">Delete</button>
        </div></div>`).join('') || '<p style="padding:16px;">No products yet.</p>'}</div>`;
}
function itemForm(i) {
  const it = i >= 0 ? adminMenu[i] : { available: true, category: '', featured: false };
  const cats = [...new Set(adminMenu.map(m => m.category))];
  openModal(`
    <h3 class="section-heading-serif" style="font-size:22px; margin:0 0 4px;">${i >= 0 ? 'Edit product' : 'Add product'}</h3>
    ${field('Name', `<input id="om-name" style="${INPUT}" maxlength="60" value="${esc(it.name || '')}" />`)}
    ${field('Price (₹, before GST)', `<input id="om-price" type="number" min="1" step="0.5" inputmode="decimal" style="${INPUT}" value="${esc(it.price || '')}" />`)}
    ${field('Category (pick or type a new one, e.g. desserts)', `<input id="om-cat" list="om-cats" style="${INPUT}" maxlength="24" value="${esc(it.category || '')}" /><datalist id="om-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`)}
    ${field('Category display name (only for a new category)', `<input id="om-catname" style="${INPUT}" maxlength="40" value="${esc(it.categoryName || '')}" />`)}
    ${field('Description', `<textarea id="om-desc" rows="2" maxlength="200" style="${INPUT}">${esc(it.description || '')}</textarea>`)}
    ${field('Image link (https://…)', `<input id="om-img" style="${INPUT}" maxlength="400" value="${esc(it.image || '')}" />`)}
    ${field('Badge (optional, e.g. New)', `<input id="om-badge" style="${INPUT}" maxlength="20" value="${esc(it.badge || '')}" />`)}
    <label style="display:block; margin-top:12px; font-size:14px;"><input type="checkbox" id="om-feat" ${it.featured ? 'checked' : ''} /> Show on home page (featured)</label>
    <label style="display:block; margin-top:6px; font-size:14px;"><input type="checkbox" id="om-avail" ${it.available !== false ? 'checked' : ''} /> Available to customers</label>
    <p id="om-error" role="alert" style="color:#b91c1c; font-size:13px; min-height:18px; margin:10px 0 0;"></p>
    <div style="display:flex; gap:8px; margin-top:8px;"><button class="btn-godaddy-dark" id="om-save" onclick="saveItem(${i})">Save</button><button class="btn-godaddy-outline" onclick="closeModal()">Cancel</button></div>`);
}
async function saveItem(i) {
  const btn = document.getElementById('om-save'); btn.disabled = true;
  const item = { id: i >= 0 ? adminMenu[i].id : undefined, name: val('om-name'), price: val('om-price'), category: val('om-cat').trim().toLowerCase(), categoryName: val('om-catname'),
    description: val('om-desc'), image: val('om-img'), badge: val('om-badge'), featured: checked('om-feat'), available: checked('om-avail') };
  try { adminMenu = (await api('/api/owner/menu', { method: 'PUT', body: JSON.stringify({ item }) })).menu; closeModal(); drawMenuAdmin(); showToast('Product saved', 'success'); }
  catch (e) { formError(e.message); btn.disabled = false; }
}
async function toggleItem(i) {
  const it = { ...adminMenu[i], available: adminMenu[i].available === false };
  try { adminMenu = (await api('/api/owner/menu', { method: 'PUT', body: JSON.stringify({ item: it }) })).menu; drawMenuAdmin(); showToast(it.available ? `${it.name} is visible again` : `${it.name} hidden from customers`, 'success'); }
  catch (e) { showToast(e.message, 'error'); }
}
async function deleteItem(i) {
  if (!confirm(`Delete "${adminMenu[i].name}" permanently? Use Hide if you only want it off the menu for now.`)) return;
  try { adminMenu = (await api('/api/owner/menu', { method: 'DELETE', body: JSON.stringify({ id: adminMenu[i].id }) })).menu; drawMenuAdmin(); showToast('Product deleted', 'success'); }
  catch (e) { showToast(e.message, 'error'); }
}

/* ---------------- Coupons ---------------- */
async function renderCoupons(view) {
  view.innerHTML = `<p class="story-text">Loading coupons…</p>`;
  try { adminCoupons = (await api('/api/owner/coupons')).coupons; } catch (e) { if (role) view.innerHTML = `<p style="color:#b91c1c">${esc(e.message)}</p>`; return; }
  drawCoupons(view);
}
function drawCoupons(view) {
  view = view || document.getElementById('staff-view');
  const desc = (c) => (c.type === 'percent' ? `${c.value}% off${c.maxDiscount ? ` (max ${rs(c.maxDiscount)})` : ''}` : `${rs(c.value)} off`) + (c.minOrder ? ` · min ${rs(c.minOrder)}` : '');
  view.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
      <span style="font-size:13px; color:#666;">Customers enter the code in their cart. GST is charged on the discounted amount.</span>
      <button class="btn-godaddy-dark" style="${SMALL_BTN}" onclick="couponForm(-1)">+ New coupon</button>
    </div>
    <div style="${CARD} padding:0; overflow:hidden;">${adminCoupons.map((c, i) => `
      <div style="display:flex; gap:12px; align-items:center; padding:12px 14px; border-top:${i ? '1px solid #eee' : '0'}; flex-wrap:wrap; opacity:${c.active ? 1 : .5};">
        <div style="flex:1; min-width:160px;"><div style="font-weight:700; letter-spacing:1px;">${esc(c.code)}${c.active ? '' : ' <span style="font-size:11px; color:#b91c1c; letter-spacing:0;">(off)</span>'}</div>
          <div style="font-size:12px; color:#777;">${esc(desc(c))}</div>
          <div style="font-size:12px; color:#777;">Used ${c.uses}${c.maxUses ? ' / ' + c.maxUses : ''} times${c.expiresAt ? ' · expires ' + esc(c.expiresAt) : ''}</div></div>
        <div style="display:flex; gap:6px;">
          <button class="btn-godaddy-outline" style="${SMALL_BTN}" onclick="couponForm(${i})">Edit</button>
          <button class="btn-godaddy-outline" style="${SMALL_BTN}" onclick="toggleCoupon(${i})">${c.active ? 'Turn off' : 'Turn on'}</button>
          <button class="btn-godaddy-outline" style="${SMALL_BTN} color:#b91c1c;" onclick="deleteCoupon(${i})">Delete</button>
        </div></div>`).join('') || '<p style="padding:16px; font-size:14px;">No coupons yet. Create one, for example WELCOME10 (10% off).</p>'}</div>`;
}
function couponForm(i) {
  const c = i >= 0 ? adminCoupons[i] : { type: 'percent', active: true };
  openModal(`
    <h3 class="section-heading-serif" style="font-size:22px; margin:0 0 4px;">${i >= 0 ? 'Edit coupon' : 'New coupon'}</h3>
    ${field('Code (letters/numbers)', `<input id="om-code" style="${INPUT} text-transform:uppercase;" maxlength="20" value="${esc(c.code || '')}" ${i >= 0 ? 'readonly' : ''} />`)}
    ${field('Type', `<select id="om-type" style="${INPUT}"><option value="percent" ${c.type === 'percent' ? 'selected' : ''}>Percentage (%)</option><option value="flat" ${c.type === 'flat' ? 'selected' : ''}>Flat amount (₹)</option></select>`)}
    ${field('Value (% or ₹)', `<input id="om-value" type="number" min="1" inputmode="decimal" style="${INPUT}" value="${esc(c.value || '')}" />`)}
    ${field('Minimum order (₹, 0 = none)', `<input id="om-min" type="number" min="0" inputmode="decimal" style="${INPUT}" value="${esc(c.minOrder || 0)}" />`)}
    ${field('Maximum discount (₹, only for %, 0 = none)', `<input id="om-max" type="number" min="0" inputmode="decimal" style="${INPUT}" value="${esc(c.maxDiscount || 0)}" />`)}
    ${field('Expiry date (optional)', `<input id="om-exp" type="date" style="${INPUT}" value="${esc(c.expiresAt || '')}" />`)}
    ${field('Total uses allowed (0 = unlimited)', `<input id="om-uses" type="number" min="0" inputmode="numeric" style="${INPUT}" value="${esc(c.maxUses || 0)}" />`)}
    <label style="display:block; margin-top:12px; font-size:14px;"><input type="checkbox" id="om-active" ${c.active !== false ? 'checked' : ''} /> Active</label>
    <p id="om-error" role="alert" style="color:#b91c1c; font-size:13px; min-height:18px; margin:10px 0 0;"></p>
    <div style="display:flex; gap:8px; margin-top:8px;"><button class="btn-godaddy-dark" id="om-save" onclick="saveCoupon()">Save</button><button class="btn-godaddy-outline" onclick="closeModal()">Cancel</button></div>`);
}
async function sendCoupon(coupon, closeAfter) {
  adminCoupons = (await api('/api/owner/coupons', { method: 'PUT', body: JSON.stringify({ coupon }) })).coupons;
  if (closeAfter) closeModal(); drawCoupons();
}
async function saveCoupon() {
  const btn = document.getElementById('om-save'); btn.disabled = true;
  try {
    await sendCoupon({ code: val('om-code'), type: val('om-type'), value: val('om-value'), minOrder: val('om-min'), maxDiscount: val('om-max'),
      expiresAt: val('om-exp'), maxUses: val('om-uses'), active: checked('om-active') }, true);
    showToast('Coupon saved', 'success');
  } catch (e) { formError(e.message); btn.disabled = false; }
}
async function toggleCoupon(i) { try { await sendCoupon({ ...adminCoupons[i], active: !adminCoupons[i].active }, false); } catch (e) { showToast(e.message, 'error'); } }
async function deleteCoupon(i) {
  if (!confirm(`Delete coupon ${adminCoupons[i].code}?`)) return;
  try { adminCoupons = (await api('/api/owner/coupons', { method: 'DELETE', body: JSON.stringify({ code: adminCoupons[i].code }) })).coupons; drawCoupons(); }
  catch (e) { showToast(e.message, 'error'); }
}
