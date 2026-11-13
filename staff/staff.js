/* Coffee & Cravings — Staff portal. Served separately from the customer site and not linked from it.
   Everything here is only useful after a server-verified PIN login (httpOnly cookie). */
'use strict';
const root = document.getElementById('staff-root');
let role = null, staffOrders = [], knownIds = null, pollTimer = null, fetching = false, ordersRev = '';
let currentTab = 'orders', kdsFilter = 'all', selectedQrPlacardTable = 1, qrToken = 0;

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

let staffAudioCtx = null;
let soundEnabled = true;

function unlockStaffAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!staffAudioCtx && AC) staffAudioCtx = new AC();
    if (staffAudioCtx && staffAudioCtx.state === 'suspended') {
      staffAudioCtx.resume().catch(() => {});
    }
  } catch (e) {}
}
['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
  window.addEventListener(evt, unlockStaffAudio, { passive: true });
});

function doPlayChime(ctx) {
  try {
    const now = ctx.currentTime;

    // First Bell Ding (880 Hz - A5 with rich overtone)
    const osc1 = ctx.createOscillator();
    const osc1Harmonic = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1Harmonic.type = 'triangle';
    osc1Harmonic.frequency.setValueAtTime(1760, now);

    gain1.gain.setValueAtTime(0.8, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain1);
    osc1Harmonic.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1Harmonic.start(now);
    osc1.stop(now + 0.6);
    osc1Harmonic.stop(now + 0.6);

    // Second Bell Dong (1318.5 Hz - E6 ringing decay)
    const t2 = now + 0.16;
    const osc2 = ctx.createOscillator();
    const osc2Harmonic = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.5, t2);
    osc2Harmonic.type = 'triangle';
    osc2Harmonic.frequency.setValueAtTime(2637, t2);

    gain2.gain.setValueAtTime(0.85, t2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 1.0);

    osc2.connect(gain2);
    osc2Harmonic.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(t2);
    osc2Harmonic.start(t2);
    osc2.stop(t2 + 1.0);
    osc2Harmonic.stop(t2 + 1.0);
  } catch (e) {
    console.warn('[Staff Audio] Tone error:', e);
  }
}

function playChimeSound() {
  if (!soundEnabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!staffAudioCtx && AC) staffAudioCtx = new AC();
    if (!staffAudioCtx) return;
    if (staffAudioCtx.state === 'suspended') {
      staffAudioCtx.resume().then(() => {
        doPlayChime(staffAudioCtx);
      }).catch(err => {
        console.warn('[Staff Audio] Autoplay deferred:', err);
      });
    } else {
      doPlayChime(staffAudioCtx);
    }
  } catch (e) {
    console.warn('[Staff Audio] Notification error:', e);
  }
}

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401) { stopPolling(); renderLogin('Session expired. Please sign in again.'); throw new Error('Session expired'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ---------------- login ----------------
function renderLogin(msg) {
  role = null; knownIds = null; staffOrders = []; ordersRev = '';
  root.innerHTML = `
    <div style="max-width:380px; margin:12vh auto 0; padding:32px 28px; background:#fff; border:1px solid #e5e5e5; border-radius:8px; text-align:center;">
      <span class="brand-title-small" style="display:block; margin-bottom:10px;">COFFEE &amp; CRAVINGS</span>
      <h2 class="section-heading-serif" style="font-size:26px; margin-bottom:6px;">Staff Sign-in</h2>
      <p class="story-text" style="font-size:14px; margin-bottom:18px;">Authorised staff only.</p>
      <form id="login-form" autocomplete="off">
        <input id="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" placeholder="Enter your PIN"
          style="width:100%; padding:12px 14px; font-size:18px; letter-spacing:6px; text-align:center; border:1px solid #ccc; border-radius:4px; margin-bottom:12px;" />
        <button type="submit" id="login-btn" class="btn-godaddy-dark full-width">Sign in</button>
      </form>
      <p id="login-msg" role="alert" style="color:#b91c1c; font-size:13px; margin-top:12px; min-height:18px;">${esc(msg || '')}</p>
    </div>`;
  const form = document.getElementById('login-form');
  document.getElementById('pin-input').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('pin-input'), btn = document.getElementById('login-btn'), out = document.getElementById('login-msg');
    const pin = input.value.trim();
    if (!/^\d{6,12}$/.test(pin)) { out.textContent = 'PIN must be 6–12 digits.'; return; }
    btn.disabled = true; out.textContent = '';
    try {
      const res = await fetch('/api/staff/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { out.textContent = data.error || 'Sign-in failed.'; input.value = ''; btn.disabled = false; input.focus(); return; }
      input.value = '';
      start(data.role);
    } catch (err) { out.textContent = 'Network problem. Please try again.'; btn.disabled = false; }
  });
}

async function staffLogout() {
  stopPolling();
  try { await fetch('/api/staff/session', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }); } catch (e) {}
  renderLogin();
}

// ---------------- shell ----------------
function start(r) {
  role = r; currentTab = 'orders';
  root.innerHTML = `
    <div style="max-width:1200px; margin:0 auto; padding:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
        <span class="brand-title-small">COFFEE &amp; CRAVINGS · STAFF</span>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <span class="kds-live-tag">${esc(role.toUpperCase())}</span>
          <button class="btn-godaddy-dark" style="font-size:12px; padding:8px 16px;" onclick="staffLogout()">Log out</button>
        </div>
      </div>
      ${role === 'owner' ? '<div id="staff-nav" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;"></div>' : ''}
      <div id="staff-offline" role="status" style="display:none; background:#fef2f2; color:#991b1b; padding:8px 12px; border-radius:6px; margin-bottom:10px; font-size:13px;">Connection lost — retrying. Orders shown may be out of date.</div>
      <div id="staff-view"></div>
    </div>`;
  showTab();
  fetchOrders();
  stopPolling();
  pollTimer = setInterval(() => fetchOrders(), 4000);
}
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && role) fetchOrders(); });

function setTab(t) { currentTab = t; showTab(); }
function renderNav() {
  const el = document.getElementById('staff-nav'); if (!el) return;
  el.innerHTML = [['orders', 'Orders'], ['reports', 'Reports'], ['menu', 'Menu'], ['deals', 'Deals (BOGO)'], ['coupons', 'Coupons'], ['customers', 'Customers'], ['inquiries', 'Inquiries'], ['qr', 'QR Codes'], ['security', 'PINs & Security']].map(([k, l]) =>
    `<button class="${currentTab === k ? 'btn-godaddy-dark' : 'btn-godaddy-outline'}" style="font-size:12px; padding:8px 16px;" onclick="setTab('${k}')">${l}</button>`).join('');
}
function showTab() {
  const v = document.getElementById('staff-view');
  if (role !== 'owner') currentTab = 'orders';
  renderNav();
  if (currentTab === 'qr') { v.innerHTML = renderQrTablesPage(); generatePlacardQr(selectedQrPlacardTable); }
  else if (currentTab === 'reports') renderReports(v);
  else if (currentTab === 'menu') renderMenuAdmin(v);
  else if (currentTab === 'deals') renderDeals(v);
  else if (currentTab === 'coupons') renderCoupons(v);
  else if (currentTab === 'customers') renderCustomers(v);
  else if (currentTab === 'inquiries') renderInquiries(v);
  else if (currentTab === 'security') renderSecuritySettings(v);
  else { v.innerHTML = renderBaristaKdsPage(); renderKdsOrders(); }
}

// ---------------- orders ----------------
async function fetchOrders(manual) {
  if (fetching) return;
  fetching = true;
  try {
    const d = await api('/api/staff/orders?rev=' + encodeURIComponent(manual ? '' : ordersRev));
    const off0 = document.getElementById('staff-offline'); if (off0) off0.style.display = 'none';
    if (d.unchanged) return;
    ordersRev = d.rev;
    const ids = new Set(d.orders.map(o => o.id));
    if (knownIds) {
      const fresh = d.orders.filter(o => !knownIds.has(o.id));
      if (fresh.length) { playChimeSound(); showToast(`${fresh.length} new order${fresh.length > 1 ? 's' : ''}!`, 'success'); }
    }
    knownIds = ids; staffOrders = d.orders;
    const off = document.getElementById('staff-offline'); if (off) off.style.display = 'none';
    if (currentTab === 'orders') renderKdsOrders();
    if (manual) showToast('Orders refreshed', 'success');
  } catch (e) {
    if (role) { const off = document.getElementById('staff-offline'); if (off) off.style.display = 'block'; }
  } finally { fetching = false; }
}

async function patchOrder(body, okMsg) {
  try { await api('/api/staff/orders', { method: 'PATCH', body: JSON.stringify(body) }); showToast(okMsg, 'success'); await fetchOrders(); }
  catch (e) { if (role) showToast(e.message, 'error'); }
}
function updateOrderStatus(orderId, newStatus) { return patchOrder({ id: orderId, status: newStatus }, `Order ${orderId} marked as ${newStatus.toUpperCase()}`); }
function markOrderPaid(orderId) { return patchOrder({ id: orderId, paid: true }, `Payment received for ${orderId}. Marked as PAID.`); }
async function cancelOrderPrompt(orderId) {
  const reason = prompt('Reason for cancelling order ' + orderId + ' (e.g. Product not available / out of stock):', 'Product not available');
  if (reason === null) return;
  await patchOrder({ id: orderId, status: 'cancelled', cancelReason: reason.trim() || 'Product not available' }, `Order ${orderId} cancelled`);
}

// ---------------- table QR (owner) ----------------
async function generatePlacardQr(tableNum) {
  const container = document.getElementById('placard-qr-container');
  if (!container) return;
  container.innerHTML = '';
  const token = ++qrToken;
  try {
    const d = await api('/api/staff/qr?table=' + tableNum);
    if (token !== qrToken) return; // a newer table was picked meanwhile
    const url = location.origin + d.path;
    window.qrCurrentUrl = url;
    const urlEl = document.getElementById('placard-target-url'); if (urlEl) urlEl.innerText = url;
    container.innerHTML = '';
    new QRCode(container, { text: url, width: 156, height: 156, colorDark: '#1a1a1a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  } catch (e) { if (role) showToast(e.message, 'error'); }
}
function simulateTableScan() { if (window.qrCurrentUrl) window.open(window.qrCurrentUrl, '_blank', 'noopener'); }

// --- 5F: TABLE QR CODE GENERATOR & SIMULATOR ---
function renderQrTablesPage() {
  return `
    <div class="qr-page-container">
      <div class="section-header-center">
        <span class="section-label-top">STAFF MANAGEMENT TOOL</span>
        <h1 class="section-heading-serif">Table QR Code Generator</h1>
        <p class="story-text" style="max-width: 600px; margin: 0 auto;">
          Generate, test, and print tabletop QR placards for your tables. When a customer scans with their phone, it opens the menu directly tagged for that specific table!
        </p>
      </div>

      <div class="qr-generator-card">
        <!-- Controls -->
        <div class="qr-controls-pane">
          <div>
            <h3 style="font-family: var(--font-display); font-size: 16px; margin-bottom: 8px;">1. Select Table Number:</h3>
            <div class="qr-table-picker-grid">
              ${[1, 2, 3, 4, 5, 6].map(n => `
                <button 
                  class="qr-table-chip ${selectedQrPlacardTable === n ? 'selected' : ''}" 
                  onclick="selectPlacardTable(${n})"
                >
                  Table ${n < 10 ? '0' + n : n}
                </button>
              `).join('')}
            </div>
          </div>

          <div style="background:#f9fafb; padding:16px; border:1px solid #e5e7eb; border-radius:4px;">
            <p style="font-size:13px; font-weight:600;">Target QR URL for Table ${selectedQrPlacardTable}:</p>
            <code id="placard-target-url" style="display:block; font-size:11px; color:#4b5563; word-break:break-all; margin-top:4px;">
              Generating secure link…
            </code>
          </div>

          <div class="d-flex" style="display:flex; flex-direction:column; gap:10px;">
            <button class="btn-godaddy-dark full-width" onclick="simulateTableScan(${selectedQrPlacardTable})">
              📱 Test / Simulate Table ${selectedQrPlacardTable} Customer Visit
            </button>
            <button class="btn-godaddy-outline full-width" onclick="window.print()">
              🖨️ Print This Placard for Table
            </button>
          </div>
        </div>

        <!-- Placard Stand Preview -->
        <div class="placard-preview-wrapper">
          <div class="printable-placard" id="printable-table-placard">
            <span class="placard-brand">Coffee &amp; Cravings</span>
            <span class="placard-tagline">“Crafted with love, served with passion.”</span>
            
            <div class="placard-qr-box" id="placard-qr-container"></div>

            <div class="placard-table-number" id="placard-table-title">TABLE 0${selectedQrPlacardTable}</div>
            <p class="placard-instructions">
              Point your phone camera to scan, explore the menu, and order straight to this table!
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}


function selectPlacardTable(tableNum) {
  selectedQrPlacardTable = tableNum;
  // Re-render QR
  document.querySelectorAll('.qr-table-chip').forEach((btn, idx) => {
    btn.classList.toggle('selected', idx + 1 === tableNum);
  });
  const title = document.getElementById('placard-table-title');
  if (title) title.innerText = `TABLE ${tableNum < 10 ? '0' + tableNum : tableNum}`;
  generatePlacardQr(tableNum);
}



// --- 5G: BARISTA LIVE KITCHEN DISPLAY SYSTEM (KDS) ---
function renderBaristaKdsPage() {
  return `
    <div class="kds-container">
      <div class="kds-header-bar">
        <div class="kds-title-group">
          <h2>
            ☕ Barista Live Kitchen Display
            <span class="kds-live-tag">LIVE FEED</span>
          </h2>
          <p class="story-text" style="font-size:14px; margin-top:4px;">
            Real-time table orders, kitchen statuses, and payment collection tracking.
          </p>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn-godaddy-dark" style="font-size:12px; padding:8px 16px;" onclick="fetchOrders(true)">
            🔄 Refresh Queue
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="kds-stats-row" id="kds-stats-row">
        <!-- Rendered via JS -->
      </div>

      <!-- Filter Tabs -->
      <div class="kds-filter-tabs">
        <button class="kds-tab-btn ${kdsFilter === 'all' ? 'active' : ''}" onclick="setKdsFilter('all')">All Orders</button>
        <button class="kds-tab-btn ${kdsFilter === 'new' ? 'active' : ''}" onclick="setKdsFilter('new')">Incoming / New</button>
        <button class="kds-tab-btn ${kdsFilter === 'preparing' ? 'active' : ''}" onclick="setKdsFilter('preparing')">Preparing</button>
        <button class="kds-tab-btn ${kdsFilter === 'ready' ? 'active' : ''}" onclick="setKdsFilter('ready')">Ready to Serve</button>
        <button class="kds-tab-btn ${kdsFilter === 'completed' ? 'active' : ''}" onclick="setKdsFilter('completed')">Completed</button>
        <button class="kds-tab-btn ${kdsFilter === 'cancelled' ? 'active' : ''}" onclick="setKdsFilter('cancelled')">Cancelled</button>
      </div>

      <!-- Orders Grid -->
      <div class="kds-orders-grid" id="kds-orders-grid">
        <!-- Injected via renderKdsOrders() -->
      </div>
    </div>
  `;
}

function setKdsFilter(filterName) {
  kdsFilter = filterName;
  document.querySelectorAll('.kds-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.toLowerCase().includes(filterName));
  });
  renderKdsOrders();
}



function renderKdsOrders() {
  const grid = document.getElementById('kds-orders-grid');
  const statsRow = document.getElementById('kds-stats-row');
  if (!grid || !statsRow) return;

  const allOrders = staffOrders;

  // Calculate statistics
  const activeCount = allOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
  const prepCount = allOrders.filter(o => o.status === 'preparing').length;
  const unpaidCounterCount = allOrders.filter(o => o.paymentStatus === 'UNPAID' && o.status !== 'cancelled').length;
  const totalSales = allOrders.filter(o => o.status !== 'cancelled' && (o.paymentStatus === 'PAID' || o.status === 'completed')).reduce((sum, o) => sum + (o.total || 0), 0);

  statsRow.innerHTML = `
    <div class="kds-stat-card">
      <span class="kds-stat-title">Active Orders</span>
      <span class="kds-stat-value">${activeCount}</span>
    </div>
    <div class="kds-stat-card">
      <span class="kds-stat-title">Kitchen Preparing</span>
      <span class="kds-stat-value highlight-amber">${prepCount}</span>
    </div>
    <div class="kds-stat-card">
      <span class="kds-stat-title">Unpaid Counter Orders</span>
      <span class="kds-stat-value ${unpaidCounterCount > 0 ? 'highlight-amber' : ''}">${unpaidCounterCount}</span>
    </div>
    <div class="kds-stat-card">
      <span class="kds-stat-title">Today's Total Sales</span>
      <span class="kds-stat-value highlight-green">₹${totalSales.toFixed(2)}</span>
    </div>
  `;

  // Filter orders
  let filtered = allOrders;
  if (kdsFilter !== 'all') {
    filtered = allOrders.filter(o => o.status === kdsFilter);
  }

  // Sort: newest first
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background:#fff; border:1px solid #e5e7eb;">
        <p style="font-size: 20px; color: #666;">No orders found in this category.</p>
        <p class="text-muted mt-1" style="font-size:14px;">Incoming orders will appear here automatically with a sound chime.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(order => {
    const isUnpaid = order.paymentStatus === 'UNPAID';
    const elapsedMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
    const timeText = elapsedMinutes <= 1 ? 'Just now' : `${elapsedMinutes}m ago`;

    return `
      <div class="kds-order-card status-${order.status}">
        <div class="kds-card-header">
          <div>
            <span class="kds-table-badge">
              ${order.table > 0 ? `TABLE 0${order.table}` : 'TAKEAWAY / COUNTER'}
            </span>
            <div style="font-size:12px; margin-top:4px; font-weight:600;">
              ${esc(order.customerName || 'Guest')} 
              ${order.phone ? `(${esc(order.phone)})` : ''}
            </div>
          </div>
          <div class="kds-order-meta">
            <strong>${order.id}</strong>
            <div>${timeText}</div>
          </div>
        </div>

        <!-- Payment Status Badge -->
        <div>
          ${order.status === 'cancelled' ? `
            <span class="kds-payment-tag" style="background:#fee2e2; color:#991b1b; border:1px solid #fecaca; font-weight:600;">
              ✕ CANCELLED &amp; VOIDED
            </span>
          ` : isUnpaid ? `
            <span class="kds-payment-tag unpaid-counter">
              ${order.paymentMethod === 'digital' ? '⚠️ VERIFY UPI PAYMENT' : '⚠️ COLLECT CASH'}: ₹${order.total.toFixed(2)}
              <button class="btn-mark-paid-inline" onclick="markOrderPaid('${order.id}')">MARK PAID</button>
            </span>
          ` : `
            <span class="kds-payment-tag paid-digital">
              ✓ PAID: ₹${order.total.toFixed(2)}
            </span>
          `}
        </div>

        <!-- Special Instructions from Table Customer -->
        ${order.specialNotes ? `
          <div class="kds-special-note-box">
            <strong>📝 Customer Note:</strong> “${esc(order.specialNotes)}”
          </div>
        ` : ''}

        <!-- Items Ordered -->
        <div class="kds-items-list">
          ${order.items.map(it => `
            <div class="kds-item-row">
              <div>
                <span class="kds-item-qty">${it.qty}x</span>
                <span>${esc(it.name)}</span>
              </div>
              <span style="font-size:13px; font-weight:600;">₹${(it.price * it.qty).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Status Actions -->
        <div class="kds-actions-row" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${order.status === 'new' ? `
            <button class="kds-action-btn btn-prepare" onclick="updateOrderStatus('${order.id}', 'preparing')">
              Start Preparing 👨‍🍳
            </button>
          ` : order.status === 'preparing' ? `
            <button class="kds-action-btn btn-ready" onclick="updateOrderStatus('${order.id}', 'ready')">
              Mark as Ready 🔔
            </button>
          ` : order.status === 'ready' ? `
            <button class="kds-action-btn btn-serve" onclick="updateOrderStatus('${order.id}', 'completed')">
              Serve &amp; Complete ✓
            </button>
          ` : order.status === 'cancelled' ? `
            <span style="font-size:12px; color:#dc2626; font-weight:600;">✕ Cancelled (${esc(order.cancelReason || 'Product unavailable')})</span>
          ` : `
            <span style="font-size:12px; color:#10b981; font-weight:600;">✓ Completed &amp; Served</span>
          `}
          ${(order.status !== 'completed' && order.status !== 'cancelled') ? `
            <button class="kds-action-btn btn-cancel-order" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-size:12px; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600; margin-left:auto;" onclick="cancelOrderPrompt('${order.id}')">
              ✕ Cancel
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}






// ---------------- boot ----------------
(async function boot() {
  try {
    const res = await fetch('/api/staff/session', { credentials: 'same-origin' });
    if (res.ok) { const d = await res.json(); start(d.role); } else renderLogin();
  } catch (e) { renderLogin('Cannot reach the server. Check your connection.'); }
})();
