/**
 * Coffee & Cravings — Application Logic
 * Customer site: menu, cart, QR table ordering
 */

// =============================================================================
// 1. MENU CATALOG (Exact Products & Prices from Coffee & Cravings GoDaddy Store)
// =============================================================================
// MENU_ITEMS now lives in menu-data.js (loaded before this file)

// =============================================================================
// 2. STATE MANAGEMENT & LOCAL STORAGE
// =============================================================================
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeHtml = esc;

let currentView = 'home';
let currentTableSig = '';
let orderSubmitting = false;
let gatewayOn = false;
let appliedCoupon = null; // rule returned by /api/config?coupon=CODE
let activeDeals = []; // promotional Buy X Get Y Free rules
let customerInfo = null; // customer CRM profile from /api/customer
let customerPhone = '';
let customerName = '';
let currentCustomerUser = null; // authenticated customer session from /api/customer/session

// Same rules as the server: discount first, GST on the discounted amount.
function calcTotals(subtotal) {
  let discount = 0;
  const c = appliedCoupon;
  if (c && subtotal >= c.minOrder) {
    discount = c.type === 'percent' ? Math.floor(subtotal * 100 * c.value / 100) / 100 : c.value;
    if (c.type === 'percent' && c.maxDiscount > 0) discount = Math.min(discount, c.maxDiscount);
    discount = Math.min(discount, subtotal);
  }
  const tax = Math.round((subtotal - discount) * 5) / 100;
  return { discount, tax, grandTotal: Math.round((subtotal - discount + tax) * 100) / 100 };
}

async function lookupCustomerInfo(phone) {
  const p = String(phone || '').replace(/[^0-9]/g, '');
  if (p.length < 6) { customerInfo = null; return null; }
  try {
    const r = await fetch('/api/customer?phone=' + encodeURIComponent(p));
    if (r.ok) {
      customerInfo = await r.json();
      renderCartCustomerState();
      return customerInfo;
    }
  } catch (e) {}
  return null;
}

function applyWelcomeCoupon(code) {
  const input = document.getElementById('coupon-input');
  if (input) input.value = code;
  applyCoupon();
}

async function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const msg = document.getElementById('coupon-msg');
  const code = (input ? input.value : '').trim();
  if (!code) return;
  if (msg) { msg.style.color = '#555'; msg.innerText = 'Checking…'; }
  const phone = (document.getElementById('cust-phone-input')?.value || customerPhone || '').trim();
  try {
    const r = await fetch('/api/config?coupon=' + encodeURIComponent(code) + '&phone=' + encodeURIComponent(phone));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Could not check the coupon.');
    appliedCoupon = d.coupon;
    renderCartDrawer();
  } catch (e) {
    appliedCoupon = null; renderCartDrawer();
    if (msg) { msg.style.color = '#b91c1c'; msg.innerText = e.message; }
  }
}
function removeCoupon() { appliedCoupon = null; renderCartDrawer(); }
let orderKey = null;
let currentTable = 0; // 0 = Walk-in/takeaway, 1-6 = Table number
let cart = []; // [{ id, qty, note }]
let currentPaymentMethod = 'digital'; // 'digital' (UPI) or 'counter' (Cash)
let orderSearchFilter = '';
let myOrdersPoller = null; // setInterval handle for live order tracking
let orderCategoryFilter = 'all';
let orderSortFilter = 'popular';
let selectedQrPlacardTable = 1;

// Load stored cart & table from localStorage
function initStorage() {
  try {
    const savedCart = localStorage.getItem('cc_cart');
    if (savedCart) cart = JSON.parse(savedCart);
  } catch (e) { cart = []; }
  try {
    customerPhone = localStorage.getItem('cc_cust_phone') || '';
    customerName = localStorage.getItem('cc_cust_name') || '';
    if (customerPhone) lookupCustomerInfo(customerPhone);
  } catch (e) {}
  try {
    const p = new URLSearchParams(window.location.search);
    const t = parseInt(p.get('table'), 10);
    const sig = p.get('sig');
    if (t >= 1 && t <= 6 && sig) {
      sessionStorage.setItem('cc_table', String(t));
      sessionStorage.setItem('cc_table_sig', sig);
      history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
    currentTable = parseInt(sessionStorage.getItem('cc_table'), 10) || 0;
    currentTableSig = sessionStorage.getItem('cc_table_sig') || '';
  } catch (e) {}
}

function saveCart() {
  try {
    localStorage.setItem('cc_cart', JSON.stringify(cart));
  } catch (e) {}
  updateCartBadge();
  renderCartDrawer();
}

function saveTable(tableNum) {
  currentTable = parseInt(tableNum, 10) || 0;
  try {
    localStorage.setItem('cc_table', currentTable);
  } catch (e) {}
  updateTablePill();
}

// =============================================================================
// 3. SOUND EFFECT GENERATOR (Web Audio API)
// =============================================================================
function playChimeSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.3); // D6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {}
}

// =============================================================================
// 4. ROUTING & VIEW NAVIGATION
// =============================================================================
function navigateTo(viewName) {
  currentView = viewName;
  window.location.hash = viewName;

  // Stop order polling when leaving that view
  if (viewName !== 'my-orders' && myOrdersPoller) {
    clearInterval(myOrdersPoller);
    myOrdersPoller = null;
  }

  // Update Nav links active state
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-nav') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const appContainer = document.getElementById('app-view-container');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  switch (viewName) {
    case 'my-orders':
      appContainer.innerHTML = renderMyOrdersPage();
      startMyOrdersPolling();
      break;
    case 'home':
      appContainer.innerHTML = renderHomePage();
      break;
    case 'order':
      appContainer.innerHTML = renderOrderPage();
      attachOrderEventListeners();
      break;
    case 'story':
      appContainer.innerHTML = renderStoryPage();
      break;
    case 'gallery':
      appContainer.innerHTML = renderGalleryPage();
      break;
    case 'contact':
      appContainer.innerHTML = renderContactPage();
      break;
    default:
      appContainer.innerHTML = renderHomePage();
  }

  updateTablePill();
}

// Listen to URL hash changes
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '') || 'home';
  if (hash !== currentView) {
    navigateTo(hash);
  }
});


// =============================================================================
// 5. VIEW RENDERERS
// =============================================================================

// --- 5A: HOME PAGE (1:1 GoDaddy Replica) ---
function renderHomePage() {
  const featured = MENU_ITEMS.filter(item => item.featured);

  return `
    <!-- HERO SPLIT SECTION -->
    <section class="godaddy-hero-section">
      <div class="hero-grid">
        <div class="hero-media-col">
          <img 
            src="https://i.vimeocdn.com/video/1972773852-c462373ce16cfc72992424520d893639a8402099a84c3667279fddacc986d86f-d_1920x1080?r=pad" 
            alt="Penne Alfredo Pasta - Coffee & Cravings" 
            class="hero-img"
          />
        </div>
        <div class="hero-content-col">
          <span class="hero-subtitle">WELCOME TO COFFEE &amp; CRAVINGS</span>
          <h1 class="hero-headline">“Crafted with love, served with passion.”</h1>
          <p class="hero-quote">“Indulge in Creamy Perfection”</p>
          <button class="btn-godaddy-dark" onclick="navigateTo('order')">
            EXPLORE MENU
          </button>
        </div>
      </div>
    </section>

    <!-- OUR STORY SECTION -->
    <section class="godaddy-story-section" id="story-section">
      <div class="story-grid">
        <div class="story-logo-col">
          <img 
            src="https://img1.wsimg.com/isteam/ip/97d5fc10-c530-4d76-9943-c97aa772d128/Coffee%20%26%20Cravings%20logo%203.jpg/:/cr=t:14.91%25,l:0%25,w:100%25,h:48.65%25/rs=w:600,h:451,cg:true" 
            alt="Coffee & Cravings Official Logo" 
            class="story-logo-img"
          />
        </div>
        <div class="story-content-col">
          <span class="section-label-top">WELCOME TO COFFEE AND CRAVINGS</span>
          <h2 class="section-heading-serif">Our Story</h2>
          <p class="story-text">
            At <strong>Coffee and Cravings</strong>, we believe that great coffee and food are more than just a treat—they’re an experience, a moment to savor, and a way to connect.
          </p>
          <p class="story-text">
            Our journey began with a simple idea: to create a space where everyone feels at home, surrounded by the aroma of freshly brewed coffee and the warmth of a welcoming ambiance. From the very first cup served, we’ve been committed to quality, passion, and community.
          </p>
          <p class="story-text">
            Every dish on our menu, from our creamy Alfredo pasta to freshly baked pizza dough, is crafted with care and a sprinkle of love. We source the finest ingredients to ensure every bite and sip brings joy to your day.
          </p>
          <p class="story-text">
            Whether you’re here for a quick coffee, a leisurely meal, or to create memories with loved ones, <strong>Coffee and Cravings</strong> is more than just a café—it’s your home away from home.
          </p>
          <p class="story-text" style="font-weight:600; color:var(--text-main);">
            Join us in celebrating the little moments that matter, one craving at a time. Welcome to Coffee and Cravings. Welcome to comfort.
          </p>
          <div class="mt-2">
            <button class="btn-godaddy-outline" onclick="navigateTo('order')">Order From Your Table</button>
          </div>
        </div>
      </div>
    </section>

    <!-- FEATURED PRODUCTS SECTION -->
    <section class="godaddy-featured-section">
      <div class="section-header-center">
        <span class="section-label-top">DISCOVER FAVORITES</span>
        <h2 class="section-heading-serif">Featured Products</h2>
      </div>
      <div class="products-grid">
        ${featured.map(item => {
          const itemDeal = (activeDeals || []).find(d => d.active !== false && d.buyItemId === item.id);
          const dealBadge = itemDeal ? `<span class="product-badge" style="background:#7c2d12; color:#fff; top:8px; right:8px; font-weight:700;">🎁 Buy ${itemDeal.buyQty} Get ${itemDeal.freeQty} Free</span>` : '';
          return `
          <div class="product-card">
            <div class="product-img-box">
              <img src="${item.image}" alt="${item.name}" class="product-img" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80';" />
              ${dealBadge || (item.badge ? `<span class="product-badge">${item.badge}</span>` : '')}
            </div>
            <div class="product-card-body">
              <h3 class="product-title">${item.name}</h3>
              <p class="product-desc">${item.description}</p>
              <div class="product-footer-row">
                <span class="product-price">₹${item.price.toFixed(2)}</span>
                <button class="btn-add-cart-card" onclick="addToCart('${item.id}')">
                  + Add to Order
                </button>
              </div>
            </div>
          </div>
        `;}).join('')}
      </div>
      <div class="text-center mt-4" style="text-align:center;">
        <button class="btn-godaddy-dark" onclick="navigateTo('order')">View Full Menu (${MENU_ITEMS.length} Items)</button>
      </div>
    </section>

    <!-- DELIGHTFUL MOMENTS GALLERY SECTION -->
    <section class="godaddy-gallery-section">
      <div class="section-header-center">
        <h2 class="section-heading-serif" style="max-width:800px; margin:0 auto; font-size:32px;">
          Experience the essence of coffee and cravings through our delightful moments captured in images.
        </h2>
      </div>
      <div class="gallery-grid">
        <div class="gallery-item">
          <img src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80" alt="Cafe Ambiance" />
          <div class="gallery-overlay"><span>Cozy Cafe Ambiance</span></div>
        </div>
        <div class="gallery-item">
          <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80" alt="Artisan Brews" />
          <div class="gallery-overlay"><span>Artisan Brews</span></div>
        </div>
        <div class="gallery-item">
          <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=700&q=80" alt="Fresh Kitchen Cravings" />
          <div class="gallery-overlay"><span>Fresh Kitchen Cravings</span></div>
        </div>
        <div class="gallery-item">
          <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80" alt="Gatherings & Connections" />
          <div class="gallery-overlay"><span>Gatherings &amp; Connections</span></div>
        </div>
        <div class="gallery-item">
          <img src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=700&q=80" alt="Barista Craft" />
          <div class="gallery-overlay"><span>Barista Craft</span></div>
        </div>
        <div class="gallery-item">
          <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=700&q=80" alt="Sweet Moments" />
          <div class="gallery-overlay"><span>Sweet Moments</span></div>
        </div>
      </div>
    </section>

    <!-- QUESTIONS OR CONCERNS / COME GRAB A CUP -->
    <section class="godaddy-contact-section">
      <div class="contact-grid">
        <!-- Left: Inquiry Form -->
        <div class="contact-form-col">
          <span class="section-label-top">GET IN TOUCH</span>
          <h2 class="section-heading-serif">Questions or Concerns?</h2>
          <form onsubmit="handleContactSubmit(event)">
            <div class="form-group">
              <label for="contact-name">Name</label>
              <input type="text" id="contact-name" placeholder="Your Full Name" required />
            </div>
            <div class="form-group">
              <label for="contact-email">Email</label>
              <input type="email" id="contact-email" placeholder="Your Email Address" required />
            </div>
            <div class="form-group">
              <label for="contact-message">Message</label>
              <textarea id="contact-message" rows="4" placeholder="How can we help make your visit extraordinary?" required></textarea>
            </div>
            <button type="submit" class="btn-godaddy-dark mt-2">Send Message</button>
            <p style="font-size:11px; color:#6b7280; margin-top:8px;">🔒 Your details are used solely to reply to your inquiry per our <a href="#privacy" onclick="openPolicyModal('privacy'); return false;" style="color:#2563eb; text-decoration:underline;">Privacy Policy</a>.</p>
          </form>
        </div>

        <!-- Right: Address & Hours -->
        <div class="contact-info-col">
          <div class="info-block">
            <h3 class="info-title">Come Grab a Cup!</h3>
            <p class="info-text">
              Have a comment or a question? Ready to place your order for delivery or pickup? Use the form or give us a call and we can get your order ready for you. Send us a message, and we will get back to you as soon as possible.
            </p>
          </div>

          <div class="info-block">
            <h4 class="info-title">Coffee &amp; Cravings Location</h4>
            <p class="info-text">
              H4RM+WXF, Mithapur Farm Area, Mithapur, Patna, Bihar 800001, India
            </p>
            <p class="mt-1">
              <a href="https://maps.app.goo.gl/7kHLJcCmuuUkmiSE8" target="_blank" rel="noopener noreferrer" class="btn-godaddy-outline" style="padding:8px 16px; font-size:11px;">
                Get Directions ↗
              </a>
            </p>
          </div>

          <div class="info-block">
            <h4 class="info-title">Phone</h4>
            <a href="tel:6205677925" class="info-link">📞 620-567-7925</a>
          </div>

          <div class="info-block">
            <h4 class="info-title">Hours</h4>
            <p class="info-text">
              <strong>Open today:</strong> 10:30 am – 10:00 pm
            </p>
          </div>
        </div>
      </div>
    </section>
  `;
}

// --- 5B: ORDER PAGE (1:1 GoDaddy Store Replica + Table Context) ---
function renderOrderPage() {
  const filteredItems = getFilteredMenuItems();

  const CAT_LABELS = {
    coffee: 'Coffee',
    frappes: 'Frappe & Iced',
    'hot-chocolate': 'Hot Chocolates',
    'classic-shakes': 'Classic Shakes',
    'premium-shakes': 'Premium Shakes',
    mocktails: 'Mocktails',
    burgers: 'Burgers & Sandwiches',
    pasta: 'Pasta',
    pizza: 'Pizza',
    'fries-sides': 'Fries & Sides',
    waffles: 'Belgian Waffles',
    desserts: 'Desserts',
    'budget-meals': 'Budget Meals',
    'add-ons': 'Add-Ons'
  };
  const catKeys = [...new Set(MENU_ITEMS.map(i => i.category))];
  const categories = [
    { key: 'all', name: 'All Products', count: MENU_ITEMS.length },
    ...catKeys.map(k => ({ key: k, name: CAT_LABELS[k] || MENU_ITEMS.find(i => i.category === k).categoryName || k, count: MENU_ITEMS.filter(i => i.category === k).length }))
  ];

  return `
    <!-- Top Latte Art Banner matching GoDaddy /order -->
    <div class="order-page-banner">
      <img 
        src="https://images.unsplash.com/photo-1509785307050-d4066910ec1e?auto=format&fit=crop&w=1500&q=80" 
        alt="Latte Art Banner" 
        class="order-banner-bg" 
      />
      <div class="order-banner-content">
        <h1 class="order-banner-title">All Products</h1>
        <p class="order-banner-subtitle">
          ${currentTable > 0 ? `Seated at Table ${currentTable < 10 ? '0' + currentTable : currentTable} &bull; Fast Table Service` : 'Order Online &bull; Dine-In or Takeaway'}
        </p>
      </div>
    </div>

    <!-- Main Order Layout -->
    <div class="order-layout-container">
      <!-- Left Category Sidebar -->
      <aside class="order-sidebar">
        <h3 class="sidebar-title">Categories</h3>
        ${categories.map(c => `
          <button 
            class="category-nav-btn ${orderCategoryFilter === c.key ? 'active' : ''}" 
            onclick="setOrderCategoryFilter('${c.key}')"
          >
            <span>${c.name}</span>
            <span class="category-count">(${c.count})</span>
          </button>
        `).join('')}
      </aside>

      <!-- Right Main Menu Grid -->
      <section class="order-main-content">
        <!-- Filter Controls Bar -->
        <div class="order-controls-bar">
          <div class="search-filter-box">
            <svg class="search-icon-inside" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input 
              type="text" 
              id="order-search-input" 
              placeholder="Search products by name..." 
              value="${orderSearchFilter}"
              oninput="handleOrderSearchInput(this.value)"
            />
          </div>

          <div class="sort-select-box">
            <select id="order-sort-select" onchange="handleOrderSortChange(this.value)">
              <option value="popular" ${orderSortFilter === 'popular' ? 'selected' : ''}>Most Popular</option>
              <option value="price-asc" ${orderSortFilter === 'price-asc' ? 'selected' : ''}>Price: Low to High</option>
              <option value="price-desc" ${orderSortFilter === 'price-desc' ? 'selected' : ''}>Price: High to Low</option>
              <option value="name" ${orderSortFilter === 'name' ? 'selected' : ''}>Alphabetical</option>
            </select>
          </div>
        </div>

        <!-- Products Grid -->
        <div class="products-grid" id="order-products-grid">
          ${filteredItems.length === 0 ? `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
              <p style="font-size: 18px; color: #666;">No items found matching your filter.</p>
              <button class="btn-godaddy-dark mt-2" onclick="setOrderCategoryFilter('all'); handleOrderSearchInput('');">Show All Items</button>
            </div>
          ` : filteredItems.map(item => {
            const itemDeal = (activeDeals || []).find(d => d.active !== false && d.buyItemId === item.id);
            const dealBadge = itemDeal ? `<span class="product-badge" style="background:#7c2d12; color:#fff; top:8px; right:8px; font-weight:700;">🎁 Buy ${itemDeal.buyQty} Get ${itemDeal.freeQty} Free</span>` : '';
            return `
            <div class="product-card">
              <div class="product-img-box">
                <img src="${item.image}" alt="${item.name}" class="product-img" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80';" />
                ${dealBadge || (item.badge ? `<span class="product-badge">${item.badge}</span>` : '')}
              </div>
              <div class="product-card-body">
                <h3 class="product-title">${item.name}</h3>
                <p class="product-desc">${item.description}</p>
                <div class="product-footer-row">
                  <span class="product-price">₹${item.price.toFixed(2)}</span>
                  <button class="btn-add-cart-card" onclick="addToCart('${item.id}')">
                    + Add to Order
                  </button>
                </div>
              </div>
            </div>
          `;}).join('')}
        </div>
      </section>
    </div>
  `;
}

// --- 5C: OUR STORY DEDICATED PAGE ---
function renderStoryPage() {
  return `
    <div style="max-width: 1100px; margin: 40px auto; padding: 0 24px;">
      <div class="story-grid">
        <div class="story-logo-col">
          <img 
            src="https://img1.wsimg.com/isteam/ip/97d5fc10-c530-4d76-9943-c97aa772d128/Coffee%20%26%20Cravings%20logo%203.jpg/:/cr=t:14.91%25,l:0%25,w:100%25,h:48.65%25/rs=w:600,h:451,cg:true" 
            alt="Coffee & Cravings Logo" 
            class="story-logo-img"
          />
        </div>
        <div class="story-content-col">
          <span class="section-label-top">OUR HERITAGE</span>
          <h1 class="section-heading-serif">Our Story</h1>
          <p class="story-text">
            At <strong>Coffee and Cravings</strong>, we believe that great coffee and food are more than just a treat—they’re an experience, a moment to savor, and a way to connect.
          </p>
          <p class="story-text">
            Our journey began with a simple idea: to create a space where everyone feels at home, surrounded by the aroma of freshly brewed coffee and the warmth of a welcoming ambiance. From the very first cup served, we’ve been committed to quality, passion, and community.
          </p>
          <p class="story-text">
            Every dish on our menu, from our creamy Alfredo pasta to freshly baked pizza dough, is crafted with care and a sprinkle of love. We source the finest ingredients to ensure every bite and sip brings joy to your day.
          </p>
          <p class="story-text">
            Whether you’re here for a quick coffee, a leisurely meal, or to create memories with loved ones, <strong>Coffee and Cravings</strong> is more than just a café—it’s your home away from home.
          </p>
          <p class="story-text" style="font-weight:600;">
            Join us in celebrating the little moments that matter, one craving at a time. Welcome to Coffee and Cravings. Welcome to comfort.
          </p>
          <div class="mt-3">
            <button class="btn-godaddy-dark" onclick="navigateTo('order')">Explore Our Offerings</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- 5D: GALLERY DEDICATED PAGE ---
function renderGalleryPage() {
  return `
    <div style="max-width: 1200px; margin: 40px auto; padding: 0 24px;">
      <div class="section-header-center">
        <span class="section-label-top">VISUAL STORIES</span>
        <h1 class="section-heading-serif">Delightful Moments</h1>
        <p class="story-text" style="max-width: 600px; margin: 0 auto;">
          Experience the essence of coffee and cravings through our delightful moments captured in images.
        </p>
      </div>

      <div class="gallery-grid" style="grid-template-columns: repeat(3, 1fr); margin-top: 40px;">
        <div class="gallery-item" style="height: 320px;">
          <img src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80" alt="Cafe Warmth" />
          <div class="gallery-overlay"><span>Warm Corner Ambiance</span></div>
        </div>
        <div class="gallery-item" style="height: 320px;">
          <img src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80" alt="Specialty Espresso" />
          <div class="gallery-overlay"><span>Specialty Espresso</span></div>
        </div>
        <div class="gallery-item" style="height: 320px;">
          <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=700&q=80" alt="Kitchen Creations" />
          <div class="gallery-overlay"><span>Artisan Kitchen Creations</span></div>
        </div>
        <div class="gallery-item" style="height: 320px;">
          <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80" alt="Friendships & Coffee" />
          <div class="gallery-overlay"><span>Friendships &amp; Coffee</span></div>
        </div>
        <div class="gallery-item" style="height: 320px;">
          <img src="https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=700&q=80" alt="Barista at Work" />
          <div class="gallery-overlay"><span>Barista Handcraft</span></div>
        </div>
        <div class="gallery-item" style="height: 320px;">
          <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=700&q=80" alt="Indulgent Treats" />
          <div class="gallery-overlay"><span>Indulgent Treats</span></div>
        </div>
      </div>
    </div>
  `;
}

// --- 5E: CONTACT DEDICATED PAGE ---
function renderContactPage() {
  return `
    <div style="max-width: 1200px; margin: 40px auto; padding: 0 24px;">
      <div class="section-header-center">
        <span class="section-label-top">VISIT US IN PATNA</span>
        <h1 class="section-heading-serif">Come Grab a Cup!</h1>
      </div>
      
      <div class="contact-grid">
        <div class="contact-form-col">
          <h2 class="section-heading-serif" style="font-size:28px;">Questions or Concerns?</h2>
          <p class="story-text">Drop us a line and we will get back to you promptly.</p>
          <form onsubmit="handleContactSubmit(event)" class="mt-2">
            <div class="form-group">
              <label for="contact-name">Name</label>
              <input type="text" id="contact-name" placeholder="Your Name" required />
            </div>
            <div class="form-group">
              <label for="contact-email">Email</label>
              <input type="email" id="contact-email" placeholder="Your Email" required />
            </div>
            <div class="form-group">
              <label for="contact-message">Message</label>
              <textarea id="contact-message" rows="4" placeholder="Your Message..." required></textarea>
            </div>
            <button type="submit" class="btn-godaddy-dark mt-2">Send Message</button>
            <p style="font-size:11px; color:#6b7280; margin-top:8px;">🔒 Your details are used solely to reply to your inquiry per our <a href="#privacy" onclick="openPolicyModal('privacy'); return false;" style="color:#2563eb; text-decoration:underline;">Privacy Policy</a>.</p>
          </form>
        </div>

        <div class="contact-info-col">
          <div class="info-block">
            <h3 class="info-title">Cafe Location</h3>
            <p class="info-text">
              H4RM+WXF, Mithapur Farm Area, Mithapur, Patna, Bihar 800001, India
            </p>
            <p class="mt-2">
              <a href="https://maps.app.goo.gl/7kHLJcCmuuUkmiSE8" target="_blank" rel="noopener noreferrer" class="btn-godaddy-outline">
                Open in Google Maps ↗
              </a>
            </p>
          </div>

          <div class="info-block">
            <h4 class="info-title">Direct Contact</h4>
            <p class="info-text">
              Phone: <a href="tel:6205677925" style="font-weight:600;">620-567-7925</a><br/>
              Email: <a href="mailto:founder@coffeeandcravings.in" style="font-weight:600;">founder@coffeeandcravings.in</a>
            </p>
          </div>

          <div class="info-block">
            <h4 class="info-title">Opening Hours</h4>
            <p class="info-text">
              Monday – Sunday: <strong>10:30 am – 10:00 pm</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// 6. ORDER PAGE FILTERING & SORTING LOGIC
// =============================================================================
function getFilteredMenuItems() {
  let list = [...MENU_ITEMS];

  // Category filter
  if (orderCategoryFilter !== 'all') {
    list = list.filter(i => i.category === orderCategoryFilter);
  }

  // Search filter
  if (orderSearchFilter.trim() !== '') {
    const q = orderSearchFilter.toLowerCase();
    list = list.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }

  // Sorting
  if (orderSortFilter === 'price-asc') {
    list.sort((a, b) => a.price - b.price);
  } else if (orderSortFilter === 'price-desc') {
    list.sort((a, b) => b.price - a.price);
  } else if (orderSortFilter === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return list;
}

function setOrderCategoryFilter(categoryKey) {
  orderCategoryFilter = categoryKey;
  if (currentView === 'order') {
    navigateTo('order');
  }
}

function handleOrderSearchInput(query) {
  orderSearchFilter = query;
  const grid = document.getElementById('order-products-grid');
  if (grid) {
    const filtered = getFilteredMenuItems();
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
          <p style="font-size: 18px; color: #666;">No items found matching "${query}".</p>
        </div>
      `;
    } else {
      grid.innerHTML = filtered.map(item => `
        <div class="product-card">
          <div class="product-img-box">
            <img src="${item.image}" alt="${item.name}" class="product-img" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80';" />
            ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ''}
          </div>
          <div class="product-card-body">
            <h3 class="product-title">${item.name}</h3>
            <p class="product-desc">${item.description}</p>
            <div class="product-footer-row">
              <span class="product-price">₹${item.price.toFixed(2)}</span>
              <button class="btn-add-cart-card" onclick="addToCart('${item.id}')">
                + Add to Order
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
}

function handleOrderSortChange(val) {
  orderSortFilter = val;
  if (currentView === 'order') {
    navigateTo('order');
  }
}

function attachOrderEventListeners() {
  const searchInput = document.getElementById('order-search-input');
  if (searchInput) {
    searchInput.focus();
  }
}

// =============================================================================
// 7. CART & CHECKOUT MANAGEMENT
// =============================================================================
function addToCart(productId) {
  const item = MENU_ITEMS.find(i => i.id === productId);
  if (!item) return;

  const existing = cart.find(c => c.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1, note: '' });
  }

  saveCart();
  showToast(`Added ${item.name} to order!`, 'success');
  toggleCartDrawer(true);
}

function changeCartQty(productId, delta) {
  const idx = cart.findIndex(c => c.id === productId);
  if (idx === -1) return;

  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) {
    cart.splice(idx, 1);
  }

  saveCart();
}

function updateCartBadge() {
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cart-badge-count');
  if (badge) {
    badge.innerText = totalCount;
  }
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer || !overlay) return;

  if (open) {
    renderCartDrawer();
    drawer.classList.add('open');
    overlay.classList.add('open');
  } else {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }
}

function onCartTableChange(val) {
  saveTable(val);
}

function renderCartCustomerState() {
  const custBanner = document.getElementById('cart-cust-banner');
  if (custBanner) {
    if (!currentCustomerUser) {
      custBanner.innerHTML = `
        <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:10px 12px; margin-bottom:10px; font-size:12px; color:#92400e; display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <span>🔒 <strong>Sign-in required</strong> to place orders</span>
          <button type="button" onclick="openCustomerAuthModal()" style="background:#92400e; color:#fff; border:none; border-radius:6px; padding:5px 10px; font-size:11px; font-weight:600; cursor:pointer; white-space:nowrap;">Sign In / Register</button>
        </div>
      `;
    } else if (customerInfo && customerInfo.isNew && customerInfo.welcomeCoupon) {
      const wc = customerInfo.welcomeCoupon;
      custBanner.innerHTML = `
        <div style="background:#eff6ff; border:1px solid #bfdbfe; color:#1e40af; padding:8px 10px; border-radius:6px; font-size:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
          <div>🌟 First order? Use <b>${wc.code}</b> for ${wc.type === 'percent' ? wc.value + '%' : '₹' + wc.value} off!</div>
          <button type="button" class="btn-godaddy-dark" style="font-size:11px; padding:4px 8px; white-space:nowrap;" onclick="applyWelcomeCoupon('${wc.code}')">Apply</button>
        </div>
      `;
    } else if (currentCustomerUser || (customerInfo && !customerInfo.isNew)) {
      const displayName = (currentCustomerUser && currentCustomerUser.name) || (customerInfo && customerInfo.name) || 'friend';
      custBanner.innerHTML = `
        <div style="font-size:12px; color:#4b5563; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
          <span>👋 Ordering as <b>${displayName}</b></span>
          <span style="color:#059669; font-weight:600; font-size:11px;">✓ Signed In</span>
        </div>
      `;
    } else {
      custBanner.innerHTML = '';
    }
  }

  const checkoutBtn = document.querySelector('.checkout-btn');
  if (checkoutBtn) {
    if (currentCustomerUser) {
      checkoutBtn.innerText = 'Proceed to Checkout';
    } else {
      checkoutBtn.innerText = '🔒 Sign In to Order';
    }
  }

  const greetEl = document.getElementById('checkout-cust-greeting');
  if (greetEl) {
    if (customerInfo && !customerInfo.isNew) {
      greetEl.innerHTML = `<span style="color:#047857; font-weight:600;">✓ Welcome back, ${customerInfo.name || 'friend'}!</span>`;
    } else if (customerInfo && customerInfo.welcomeCoupon) {
      greetEl.innerHTML = `<span style="color:#1d4ed8; font-weight:600;">🌟 Eligible for first-order coupon: <b>${customerInfo.welcomeCoupon.code}</b></span>`;
    } else {
      greetEl.innerHTML = '';
    }
  }
}

function getSuitedAddonsForProduct(product) {
  if (!product || !product.id || !product.category) return [];

  // Exclude add-ons themselves from having suggestions
  if (product.category === 'add-ons') return [];

  // Specifically map items that taste significantly better with sweet/dessert add-ons
  const map = {
    // Classic Shakes
    'mango-shake': ['addon-vanilla-ice-cream', 'addon-oreo-crumbles', 'addon-white-chocochips'],
    'strawberry-shake': ['addon-vanilla-ice-cream', 'addon-white-chocochips', 'addon-oreo-crumbles'],
    'banana-shake': ['addon-vanilla-ice-cream', 'addon-black-chocochips', 'addon-oreo-crumbles'],
    'black-currant-shake': ['addon-vanilla-ice-cream', 'addon-white-chocochips'],
    'oreo-slush': ['addon-oreo-crumbles', 'addon-chocolate-ice-cream', 'addon-kitkat-bits'],
    'choco-coco-shake': ['addon-chocolate-ice-cream', 'addon-black-chocochips', 'addon-kitkat-bits'],
    'butterscotch-ice-cream-shake': ['addon-vanilla-ice-cream', 'addon-white-chocochips', 'addon-oreo-crumbles'],
    'vanilla-ice-cream-shake': ['addon-black-chocochips', 'addon-oreo-crumbles', 'addon-kitkat-bits'],
    'kesar-pista-ice-cream-shake': ['addon-vanilla-ice-cream', 'addon-white-chocochips'],

    // Premium Shakes
    'caramel-oreo': ['addon-oreo-crumbles', 'addon-vanilla-ice-cream', 'addon-black-chocochips'],
    'caramel-chocochips': ['addon-black-chocochips', 'addon-white-chocochips', 'addon-vanilla-ice-cream'],
    'chocochip-shake': ['addon-black-chocochips', 'addon-chocolate-ice-cream', 'addon-oreo-crumbles'],
    'hazelnut-chocochips': ['addon-black-chocochips', 'addon-chocolate-ice-cream', 'addon-kitkat-bits'],
    'oreo-kitkat-mudshake': ['addon-kitkat-bits', 'addon-oreo-crumbles', 'addon-chocolate-ice-cream'],
    'real-fruit-shake': ['addon-vanilla-ice-cream', 'addon-white-chocochips'],
    'butter-popcorn-shake': ['addon-vanilla-ice-cream', 'addon-white-chocochips'],

    // Frappes & Cold Coffees
    'og-cold-coffee': ['addon-vanilla-ice-cream', 'addon-chocolate-ice-cream', 'addon-black-chocochips'],
    'iced-latte': ['addon-vanilla-ice-cream', 'addon-black-chocochips'],
    'vietnamese-iced-latte': ['addon-vanilla-ice-cream', 'addon-black-chocochips'],
    'hazelnut-frappe': ['addon-chocolate-ice-cream', 'addon-black-chocochips', 'addon-kitkat-bits'],
    'french-vanilla-frappe': ['addon-vanilla-ice-cream', 'addon-white-chocochips', 'addon-oreo-crumbles'],
    'caramel-frappe': ['addon-vanilla-ice-cream', 'addon-white-chocochips', 'addon-black-chocochips'],
    'iced-mocha': ['addon-chocolate-ice-cream', 'addon-black-chocochips', 'addon-oreo-crumbles'],

    // Hot Chocolates
    'belgian-hot-chocolate': ['addon-black-chocochips', 'addon-white-chocochips', 'addon-vanilla-ice-cream'],
    'hazelnut-hot-chocolate': ['addon-black-chocochips', 'addon-kitkat-bits', 'addon-chocolate-ice-cream'],
    'irish-cream-hot-chocolate': ['addon-white-chocochips', 'addon-vanilla-ice-cream'],

    // Belgian Waffles
    'kitkat-break': ['addon-kitkat-bits', 'addon-vanilla-ice-cream', 'addon-chocolate-ice-cream'],
    'red-velvet-cream': ['addon-white-chocochips', 'addon-vanilla-ice-cream'],
    'triple-chocolate-therapy': ['addon-chocolate-ice-cream', 'addon-black-chocochips', 'addon-oreo-crumbles'],
    'nutella-banana': ['addon-vanilla-ice-cream', 'addon-black-chocochips', 'addon-kitkat-bits'],

    // Desserts
    'brownie-sizzler': ['addon-vanilla-ice-cream', 'addon-chocolate-ice-cream', 'addon-black-chocochips'],
    'belgian-banoffee-pancake': ['addon-vanilla-ice-cream', 'addon-black-chocochips', 'addon-white-chocochips'],
    'italian-tiramisu': ['addon-black-chocochips', 'addon-chocolate-ice-cream'],
    'cheesecake': ['addon-white-chocochips', 'addon-vanilla-ice-cream'],

    // Sweet Specialty Coffees
    'caramel-cappuccino': ['addon-vanilla-ice-cream', 'addon-black-chocochips'],
    'hazelnut-cappuccino': ['addon-chocolate-ice-cream', 'addon-black-chocochips'],
    'caffe-mocha': ['addon-black-chocochips', 'addon-chocolate-ice-cream', 'addon-vanilla-ice-cream']
  };

  if (map[product.id]) return map[product.id];

  // Category fallbacks for shakes, frappes, waffles, desserts
  if (product.category === 'classic-shakes' || product.category === 'premium-shakes') {
    return ['addon-vanilla-ice-cream', 'addon-oreo-crumbles', 'addon-black-chocochips'];
  }
  if (product.category === 'frappes') {
    return ['addon-vanilla-ice-cream', 'addon-chocolate-ice-cream'];
  }
  if (product.category === 'hot-chocolate') {
    return ['addon-black-chocochips', 'addon-white-chocochips'];
  }
  if (product.category === 'waffles' || product.category === 'desserts') {
    return ['addon-vanilla-ice-cream', 'addon-chocolate-ice-cream', 'addon-oreo-crumbles'];
  }

  // All savory categories (burgers, pasta, pizza, fries-sides, mocktails, budget-meals) return []
  return [];
}

function addSuggestedAddon(addonId) {
  const item = MENU_ITEMS.find(i => i.id === addonId);
  if (!item) return;

  const existing = cart.find(c => c.id === addonId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: addonId, qty: 1, note: '' });
  }

  saveCart();
  showToast(`Added ${item.name} (+₹${item.price}) to order!`, 'success');
}

function renderCartDrawer() {
  const container = document.getElementById('cart-items-container');
  const footer = document.getElementById('cart-drawer-footer');
  const countText = document.getElementById('cart-items-count-text');
  const tableSelect = document.getElementById('cart-table-select');

  if (tableSelect) {
    tableSelect.value = currentTable;
  }

  if (!container || !footer) return;

  const totalCount = cart.reduce((sum, i) => sum + i.qty, 0);
  if (countText) countText.innerText = `${totalCount} item${totalCount === 1 ? '' : 's'}`;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <div class="empty-cart-icon">☕</div>
        <p class="empty-cart-title">Your order is empty</p>
        <p class="empty-cart-sub">Select our artisan coffees, creamy pastas, or burgers to add!</p>
        <button class="btn-godaddy-dark mt-2" onclick="toggleCartDrawer(false); navigateTo('order');">Browse Full Menu</button>
      </div>
    `;
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';

  let subtotal = 0;
  const itemsHtml = cart.map(cartItem => {
    const product = MENU_ITEMS.find(p => p.id === cartItem.id);
    if (!product) return '';
    const itemTotal = product.price * cartItem.qty;
    subtotal += itemTotal;

    // Check suited add-ons for this product
    const suitedAddonIds = getSuitedAddonsForProduct(product);
    let addonsHtml = '';
    if (suitedAddonIds && suitedAddonIds.length > 0) {
      const chips = suitedAddonIds.map(addonId => {
        const addon = MENU_ITEMS.find(m => m.id === addonId);
        if (!addon) return '';
        const inCart = cart.some(c => c.id === addonId);
        if (inCart) {
          return `
            <button type="button" class="addon-chip-btn is-added" title="Already in your order">
              ✓ ${addon.name} <span class="addon-chip-price">Added</span>
            </button>
          `;
        }
        return `
          <button type="button" class="addon-chip-btn" onclick="addSuggestedAddon('${addon.id}')" title="Tap to add ${addon.name} (+₹${addon.price})">
            + ${addon.name} <span class="addon-chip-price">₹${addon.price}</span>
          </button>
        `;
      }).filter(Boolean).join('');

      if (chips) {
        addonsHtml = `
          <div class="cart-item-addons-suggest">
            <div class="addon-suggest-header">
              <span>✨ Recommended Add-ons:</span>
            </div>
            <div class="addon-chips-list">
              ${chips}
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="cart-item-group">
        <div class="cart-item-row">
          <img src="${product.image}" alt="${product.name}" class="cart-item-img" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80';" />
          <div class="cart-item-details">
            <div>
              <h4 class="cart-item-name">${product.name}</h4>
              <span class="cart-item-price">₹${product.price.toFixed(2)}</span>
            </div>
            <div class="cart-qty-controls">
              <button class="qty-btn" onclick="changeCartQty('${product.id}', -1)">-</button>
              <span class="qty-number">${cartItem.qty}</span>
              <button class="qty-btn" onclick="changeCartQty('${product.id}', 1)">+</button>
            </div>
          </div>
        </div>
        ${addonsHtml}
      </div>
    `;
  }).join('');

  // Promotional Buy X Get Y Free Deals
  let promoHtml = '';
  const dealAlerts = [];
  for (const deal of (activeDeals || []).filter(d => d.active !== false)) {
    const buyItem = cart.find(i => i.id === deal.buyItemId);
    const bought = buyItem ? buyItem.qty : 0;
    const freeItem = MENU_ITEMS.find(m => m.id === deal.freeItemId);
    if (!freeItem) continue;
    const times = Math.floor(bought / deal.buyQty);
    if (times > 0) {
      const freeQty = times * deal.freeQty;
      dealAlerts.push(`
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:8px 10px; border-radius:6px; font-size:12px; margin-bottom:8px;">
          🎉 <b>Offer Unlocked:</b> ${deal.name} (+${freeQty}x ${freeItem.name} FREE)
        </div>
      `);
      promoHtml += `
        <div class="cart-item-row" style="background:#f0fdf4; border-radius:6px; padding:8px 10px; border:1px dashed #86efac; margin-top:6px;">
          <img src="${freeItem.image}" alt="${freeItem.name}" class="cart-item-img" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80';" />
          <div class="cart-item-details">
            <div>
              <h4 class="cart-item-name">${freeItem.name} <span style="font-size:10px; background:#16a34a; color:#fff; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:700;">FREE PROMO</span></h4>
              <span class="cart-item-price" style="color:#16a34a; font-weight:700;">₹0.00</span>
            </div>
            <div style="font-size:12px; font-weight:600; color:#16a34a;">Qty: ${freeQty}</div>
          </div>
        </div>
      `;
    } else if (bought > 0) {
      const buyItemName = MENU_ITEMS.find(m => m.id === deal.buyItemId)?.name || '';
      dealAlerts.push(`
        <div style="background:#fffbeb; border:1px solid #fef3c7; color:#92400e; padding:6px 10px; border-radius:6px; font-size:11px; margin-bottom:8px;">
          ✨ Add ${deal.buyQty - bought} more <b>${buyItemName}</b> to get ${deal.freeQty}x ${freeItem.name} FREE!
        </div>
      `);
    }
  }

  const dealsBannerEl = document.getElementById('cart-deals-banner');
  if (dealsBannerEl) dealsBannerEl.innerHTML = dealAlerts.join('');
  renderCartCustomerState();

  container.innerHTML = itemsHtml + promoHtml;

  const { discount, tax, grandTotal } = calcTotals(subtotal);

  const subtotalEl = document.getElementById('cart-subtotal');
  const discRow = document.getElementById('cart-discount-row');
  const couponMsg = document.getElementById('coupon-msg');
  if (discRow) {
    discRow.style.display = discount > 0 ? 'flex' : 'none';
    document.getElementById('cart-discount').innerText = `−₹${discount.toFixed(2)}`;
  }
  if (couponMsg && appliedCoupon) {
    if (discount > 0) {
      couponMsg.style.color = '#15803d';
      couponMsg.innerHTML = `✓ ${appliedCoupon.code} applied <a href="#" onclick="removeCoupon(); return false;" style="margin-left:8px;">Remove</a>`;
    } else {
      couponMsg.style.color = '#b45309';
      couponMsg.innerText = `${appliedCoupon.code}: add items worth ₹${appliedCoupon.minOrder} or more to use it.`;
    }
  }
  const taxEl = document.getElementById('cart-tax');
  const grandTotalEl = document.getElementById('cart-grand-total');

  if (subtotalEl) subtotalEl.innerText = `₹${subtotal.toFixed(2)}`;
  if (taxEl) taxEl.innerText = `₹${tax.toFixed(2)}`;
  if (grandTotalEl) grandTotalEl.innerText = `₹${grandTotal.toFixed(2)}`;
}

// =============================================================================
// 8. CHECKOUT & DUAL PAYMENT PROCESSOR
// =============================================================================
function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('Please add items to your cart first', 'warning');
    return;
  }

  // Mandatory signup / login rule before ordering
  if (!currentCustomerUser) {
    toggleCartDrawer(false);
    openCustomerAuthModal();
    setAuthStatusMsg('Please sign in or create an account to proceed with your order.', true);
    showToast('Please sign in before placing your order', 'warning');
    window._pendingCheckout = true;
    return;
  }

  toggleCartDrawer(false);

  const modal = document.getElementById('checkout-modal');
  const body = document.getElementById('checkout-modal-body');
  const successState = document.getElementById('order-success-state');

  if (!modal || !body || !successState) return;

  body.style.display = 'block';
  successState.style.display = 'none';

  // Table heading
  const tableHeading = document.getElementById('checkout-table-heading');
  if (tableHeading) {
    tableHeading.innerText = currentTable > 0 ? `Table 0${currentTable}` : 'Takeaway / Counter';
  }

  // Calculate totals
  let subtotal = 0;
  cart.forEach(c => {
    const p = MENU_ITEMS.find(m => m.id === c.id);
    if (p) subtotal += p.price * c.qty;
  });
  const { grandTotal } = calcTotals(subtotal);

  const totalHeading = document.getElementById('checkout-total-heading');
  if (totalHeading) {
    totalHeading.innerText = `₹${grandTotal.toFixed(2)}`;
  }

  // Render UPI QR code dynamically for the total amount
  generateDynamicPaymentUpi(grandTotal);

  const phoneInput = document.getElementById('cust-phone-input');
  const nameInput = document.getElementById('cust-name-input');
  const activePhone = customerPhone || (currentCustomerUser && currentCustomerUser.phone) || '';
  const activeName = customerName || (currentCustomerUser && currentCustomerUser.name) || '';
  if (phoneInput && activePhone) phoneInput.value = activePhone;
  if (nameInput && activeName) nameInput.value = activeName;
  if (phoneInput) {
    phoneInput.onchange = () => {
      const p = phoneInput.value.trim();
      if (p) lookupCustomerInfo(p);
    };
    phoneInput.oninput = () => {
      phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '').slice(0, 10);
      phoneInput.style.borderColor = '';
      phoneInput.style.boxShadow = '';
      const p = phoneInput.value;
      if (p.length >= 10) lookupCustomerInfo(p);
    };
  }
  renderCartCustomerState();

  selectPaymentMethod('digital');
  modal.classList.add('open');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.remove('open');
}

function selectPaymentMethod(method) {
  if (method !== currentPaymentMethod) orderKey = null; // a different payment choice is a different checkout
  currentPaymentMethod = method;

  const cardDigital = document.getElementById('pay-card-digital');
  const cardCounter = document.getElementById('pay-card-counter');
  const subviewDigital = document.getElementById('digital-subview');
  const subviewCounter = document.getElementById('counter-subview');
  const confirmBtn = document.getElementById('confirm-order-btn');

  if (method === 'digital') {
    cardDigital.classList.add('selected');
    cardCounter.classList.remove('selected');
    subviewDigital.style.display = 'block';
    subviewCounter.style.display = 'none';
    if (gatewayOn) {
      subviewDigital.innerHTML = '<p class="story-text" style="font-size:14px;">You will pay in a secure payment window (UPI, cards, netbanking). Your order goes to the kitchen as soon as the payment is confirmed.</p>';
      if (confirmBtn) confirmBtn.innerText = 'Pay Securely Online';
    } else if (confirmBtn) confirmBtn.innerText = 'I Have Paid Online — Confirm Table Order';
  } else {
    cardCounter.classList.add('selected');
    cardDigital.classList.remove('selected');
    subviewCounter.style.display = 'block';
    subviewDigital.style.display = 'none';
    if (confirmBtn) confirmBtn.innerText = 'Place Order — Pay Cash at Counter';
  }

  const counterTableNum = document.querySelector('.counter-table-num');
  if (counterTableNum) {
    counterTableNum.innerText = currentTable > 0 ? `0${currentTable}` : 'Takeaway';
  }
}

function generateDynamicPaymentUpi(amount) {
  const qrcodeWrapper = document.getElementById('dynamic-upi-qrcode');
  if (!qrcodeWrapper) return;
  qrcodeWrapper.innerHTML = '';

  // Standard UPI URI format
  const upiUri = `upi://pay?pa=founder@coffeeandcravings.in&pn=CoffeeAndCravings&am=${amount.toFixed(2)}&cu=INR&tn=Table${currentTable}`;

  new QRCode(qrcodeWrapper, {
    text: upiUri,
    width: 160,
    height: 160,
    colorDark: '#1a1a1a',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const el = document.createElement('script');
    el.src = 'https://checkout.razorpay.com/v1/checkout.js';
    el.onload = resolve;
    el.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.head.appendChild(el);
  });
}

// Opens the gateway window. Resolves true only after OUR server verified the payment signature.
async function payOnline(order, pay, name, phone) {
  await loadRazorpay();
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const rz = new Razorpay({
      key: pay.keyId, amount: pay.amount, currency: pay.currency, order_id: pay.orderId,
      name: 'Coffee & Cravings', description: 'Order ' + order.id,
      prefill: { name: name === 'Guest' ? '' : name, contact: phone }, theme: { color: '#1a1a1a' },
      handler: async (r) => {
        try {
          const v = await fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
          const d = await v.json().catch(() => ({}));
          if (!v.ok) throw new Error(d.error || 'Could not confirm payment');
          finish(true);
        } catch (e) {
          showToast('We could not confirm your payment yet. If money was deducted your order will reach the kitchen shortly. Order ID: ' + order.id, 'warning');
          finish(false);
        }
      },
      modal: { ondismiss: () => { showToast('Payment not completed. Your order has not been sent to the kitchen yet.', 'warning'); finish(false); } }
    });
    rz.on('payment.failed', () => showToast('Payment failed. You can try again.', 'error'));
    rz.open();
  });
}

async function submitFinalOrder() {
  if (cart.length === 0 || orderSubmitting) return;

  // Extra safeguard: mandatory signup/login
  if (!currentCustomerUser) {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('open');
    openCustomerAuthModal();
    setAuthStatusMsg('Please sign in or create an account to place an order.', true);
    showToast('Please sign in to place your order', 'warning');
    window._pendingCheckout = true;
    return;
  }

  const phoneEl = document.getElementById('cust-phone-input');
  const rawPhone = (phoneEl ? phoneEl.value : (customerPhone || '')).trim();
  const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

  if (!cleanPhone || cleanPhone.length !== 10) {
    showToast('Please enter your 10-digit mobile phone number.', 'warning');
    if (phoneEl) {
      phoneEl.focus();
      phoneEl.style.borderColor = '#ef4444';
      phoneEl.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.2)';
      phoneEl.addEventListener('input', () => {
        phoneEl.style.borderColor = '';
        phoneEl.style.boxShadow = '';
      }, { once: true });
    }
    return;
  }

  orderSubmitting = true;

  const custName = document.getElementById('cust-name-input')?.value.trim() || 'Guest';
  const custPhone = cleanPhone;
  const specialNotes = document.getElementById('order-special-notes')?.value.trim() || '';
  if (!orderKey) {
    if (window.crypto && crypto.randomUUID) {
      orderKey = crypto.randomUUID();
    } else {
      const arr = new Uint32Array(2);
      if (window.crypto && crypto.getRandomValues) window.crypto.getRandomValues(arr);
      orderKey = Date.now() + '-' + (arr[0] ? arr[0].toString(36) + arr[1].toString(36) : Date.now().toString(36));
    }
  }

  let order;
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: orderKey, table: currentTable, sig: currentTableSig, coupon: appliedCoupon ? appliedCoupon.code : '',
        customerName: custName, phone: custPhone, paymentMethod: currentPaymentMethod,
        specialNotes, items: cart.map(c => ({ id: c.id, qty: c.qty }))
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not place the order. Please try again.');
    order = data.order;
    if (data.payment) {
      const paid = await payOnline(order, data.payment, custName, custPhone);
      if (!paid) { orderSubmitting = false; return; } // order key kept: retrying reuses the same pending order
      order = { ...order, status: 'new', paymentStatus: 'PAID' };
    }
  } catch (err) {
    orderSubmitting = false;
    if (/coupon/i.test(err.message || '')) { appliedCoupon = null; renderCartDrawer(); }
    showToast(err.message || 'Network problem. Please try again.', 'error');
    return;
  }
  orderSubmitting = false;
  orderKey = null;
  appliedCoupon = null;

  if (custPhone) {
    customerPhone = custPhone;
    try { localStorage.setItem('cc_cust_phone', custPhone); } catch (e) {}
    if (currentCustomerUser && currentCustomerUser.phone !== custPhone) {
      currentCustomerUser.phone = custPhone;
      fetch('/api/customer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentCustomerUser.uid,
          phone: custPhone,
          email: currentCustomerUser.email || '',
          name: custName !== 'Guest' ? custName : (currentCustomerUser.name || '')
        })
      }).catch(() => {});
    }
  }
  if (custName && custName !== 'Guest') {
    customerName = custName;
    try { localStorage.setItem('cc_cust_name', custName); } catch (e) {}
  }

  const orderId = order.id;
  try {
    const recent = JSON.parse(localStorage.getItem('cc_recent_orders') || '[]');
    if (!recent.includes(orderId)) {
      recent.unshift(orderId);
      localStorage.setItem('cc_recent_orders', JSON.stringify(recent.slice(0, 10)));
    }
  } catch (e) {}
  const orderItems = order.items;
  const grandTotal = order.total;

  // Play audio chime and trigger animated checkmark popup
  playChimeSound();
  showOrderPlacedPopup(orderId, currentTable);

  // Clear cart
  cart = [];
  saveCart();
  const notesInput = document.getElementById('order-special-notes');
  if (notesInput) notesInput.value = '';

  // Render receipt ticket in success state
  const body = document.getElementById('checkout-modal-body');
  const successState = document.getElementById('order-success-state');

  if (body && successState) {
    body.style.display = 'none';
    successState.style.display = 'block';

    document.getElementById('success-receipt-id').innerText = orderId;
    document.getElementById('success-receipt-table').innerText = currentTable > 0 ? `Table 0${currentTable}` : 'Takeaway';
    document.getElementById('success-receipt-total').innerText = `₹${grandTotal.toFixed(2)}`;

    const payStatusEl = document.getElementById('success-receipt-payment');
    if (payStatusEl) {
      if (order.paymentStatus === 'PAID') {
        payStatusEl.innerHTML = `<span class="badge-rec" style="font-size:12px; padding:4px 8px;">✓ PAID: Online payment confirmed</span>`;
      } else if (currentPaymentMethod === 'digital') {
        payStatusEl.innerHTML = `<span class="badge-rec" style="font-size:12px; padding:4px 8px;">UPI: barista will confirm your payment</span>`;
      } else {
        payStatusEl.innerHTML = `<span class="badge-counter" style="font-size:12px; padding:4px 8px;">💵 UNPAID: Pay Cash at Barista Counter</span>`;
      }
    }

    const itemsContainer = document.getElementById('success-receipt-items');
    if (itemsContainer) {
      itemsContainer.innerHTML = orderItems.map(it => `
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
          <span>${it.qty}x ${it.name}</span>
          <span>₹${(it.price * it.qty).toFixed(2)}</span>
        </div>
      `).join('');
    }
  }

  showToast(`Order ${orderId} submitted! Barista alerted.`, 'success');

  // Automatically navigate to live order tracker after a short delay
  setTimeout(() => {
    // Close checkout modal first
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('open');
    navigateTo('my-orders');
  }, 2800);
}

// =============================================================================
// 9. TABLE PICKER MODAL
// =============================================================================
function openTablePickerModal() {
  const modal = document.getElementById('table-picker-modal');
  if (modal) {
    const btns = modal.querySelectorAll('.table-select-btn');
    btns.forEach((btn, idx) => {
      if (idx === currentTable) {
        btn.style.background = '#1a1a1a';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#1a1a1a';
      } else {
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }
    });
    modal.classList.add('open');
  }
}

function closeTablePickerModal() {
  const modal = document.getElementById('table-picker-modal');
  if (modal) modal.classList.remove('open');
}

function setSeatedTable(tableNum) {
  saveTable(tableNum);
  closeTablePickerModal();
  showToast(tableNum > 0 ? `Seated at Table 0${tableNum}` : 'Ordering for Takeaway / Counter', 'success');
  if (currentView === 'order') {
    navigateTo('order');
  }
}

function updateTablePill() {
  const textEl = document.getElementById('table-pill-text');
  const banner = document.getElementById('table-active-banner');
  const bannerBadge = document.getElementById('table-banner-badge');

  if (textEl) {
    textEl.innerText = currentTable > 0 ? `Table 0${currentTable} (Dine-in)` : 'Takeaway / Counter';
  }

  if (banner && bannerBadge) {
    if (currentTable > 0) {
      banner.style.display = 'block';
      bannerBadge.innerText = `TABLE 0${currentTable}`;
    } else {
      banner.style.display = 'none';
    }
  }
}

// =============================================================================
// 10. SEARCH & MODALS
// =============================================================================
function openSearchModal() {
  const modal = document.getElementById('search-modal');
  if (modal) {
    modal.classList.add('open');
    const input = document.getElementById('menu-search-input');
    if (input) {
      input.value = '';
      input.focus();
      handleMenuSearch('');
    }
  }
}

function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  if (modal) modal.classList.remove('open');
}

function handleMenuSearch(q) {
  const container = document.getElementById('search-results-list');
  if (!container) return;

  const matches = q.trim() === '' 
    ? MENU_ITEMS.slice(0, 6) 
    : MENU_ITEMS.filter(i => i.name.toLowerCase().includes(q.toLowerCase()) || i.description.toLowerCase().includes(q.toLowerCase()));

  container.innerHTML = matches.map(item => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f0f0f0;">
      <div style="display:flex; align-items:center; gap:12px;">
        <img src="${item.image}" alt="${item.name}" style="width:48px; height:48px; border-radius:4px; object-fit:cover;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=700&q=80';" />
        <div>
          <h4 style="font-size:15px; font-family:var(--font-serif);">${item.name}</h4>
          <span style="font-size:13px; font-weight:600;">₹${item.price.toFixed(2)}</span>
        </div>
      </div>
      <button class="btn-godaddy-dark" style="padding:6px 14px; font-size:11px;" onclick="addToCart('${item.id}'); closeSearchModal();">
        + Add
      </button>
    </div>
  `).join('');
}


function openPolicyModal(type) {
  const modal = document.getElementById('policy-modal');
  const title = document.getElementById('policy-title');
  const body = document.getElementById('policy-body');

  if (!modal || !title || !body) return;

  if (type === 'privacy') {
    title.innerText = 'Privacy Policy';
    body.innerHTML = `
      <p style="font-size:12px; color:#6b7280; margin-bottom:12px;"><strong>Last Updated: May 2026</strong></p>
      
      <p class="mt-2">Coffee &amp; Cravings ("we", "us", "our") respects your privacy and is committed to processing your personal data lawfully, transparently, and securely.</p>

      <div style="margin-top:14px;">
        <h4 style="font-size:14px; font-weight:700; color:#1f2937; margin-bottom:4px;">1. Personal Data We Collect</h4>
        <p style="font-size:13px; line-height:1.5; color:#4b5563;">To serve you at our cafe, we collect only the minimal personal data necessary:</p>
        <ul style="font-size:13px; line-height:1.6; color:#4b5563; padding-left:18px; margin-top:4px;">
          <li><strong>Identity &amp; Contact:</strong> Name, phone number, and email address (via Google Sign-In, 6-digit email OTP, or guest checkout).</li>
          <li><strong>Order &amp; Dining Details:</strong> Table number, dine-in/takeaway choice, items ordered, custom dietary notes, transaction timestamp.</li>
          <li><strong>Payment References:</strong> Bank transaction/UTR reference numbers generated by certified UPI payment gateways. <em>(We never handle or store your debit/credit card CVV or PIN numbers.)</em></li>
          <li><strong>Customer Communications:</strong> Messages, feedback, or support queries submitted via our contact forms.</li>
        </ul>
      </div>

      <div style="margin-top:14px;">
        <h4 style="font-size:14px; font-weight:700; color:#1f2937; margin-bottom:4px;">2. Purpose of Processing</h4>
        <p style="font-size:13px; line-height:1.5; color:#4b5563;">Your personal data is processed solely for specific, legitimate dining purposes:</p>
        <ul style="font-size:13px; line-height:1.6; color:#4b5563; padding-left:18px; margin-top:4px;">
          <li>Preparing and kitchen-dispatching your handcrafted orders accurately to your table or counter.</li>
          <li>Generating authentic digital bills, receipts, and GST-compliant invoices.</li>
          <li>Sending live order updates and one-time sign-in verification codes (OTPs).</li>
          <li>Answering your inquiries or customer service requests.</li>
          <li>Delivering optional loyalty perks (e.g. welcome coupon, BOGO offers) if you choose to participate.</li>
        </ul>
        <p style="font-size:12px; color:#15803d; font-weight:600; margin-top:6px;">✓ We never sell, rent, broker, or share your personal data with third-party advertising brokers.</p>
      </div>

      <div style="margin-top:14px;">
        <h4 style="font-size:14px; font-weight:700; color:#1f2937; margin-bottom:4px;">3. Your Privacy Rights</h4>
        <p style="font-size:13px; line-height:1.5; color:#4b5563;">You have full ownership and control over your personal data:</p>
        <ul style="font-size:13px; line-height:1.6; color:#4b5563; padding-left:18px; margin-top:4px;">
          <li><strong>Right to Access:</strong> View your active receipts, profile, and lifetime order history anytime under "My Orders".</li>
          <li><strong>Right to Correction:</strong> Update inaccurate information by signing in or requesting an update.</li>
          <li><strong>Right to Erasure:</strong> Permanently delete your account, contact profile, and saved order records at any time directly through your account drawer using the <em>"Delete Account &amp; Order History"</em> button, or by emailing our Grievance Officer.</li>
          <li><strong>Right to Grievance Redressal:</strong> Submit any inquiry, concern, or complaint regarding your data privacy directly to our designated Grievance Officer.</li>
        </ul>
      </div>

      <div style="margin-top:14px;">
        <h4 style="font-size:14px; font-weight:700; color:#1f2937; margin-bottom:4px;">4. Data Security &amp; Retention</h4>
        <p style="font-size:13px; line-height:1.5; color:#4b5563;">We implement reasonable technical and organizational safeguards:</p>
        <ul style="font-size:13px; line-height:1.6; color:#4b5563; padding-left:18px; margin-top:4px;">
          <li>Active kitchen queue tickets automatically expire and are purged after 24 hours.</li>
          <li>Login OTPs are cryptographically hashed (SHA-256) and purged automatically after 5 minutes.</li>
          <li>Session cookies are protected with encrypted, HTTP-only, and SameSite strict attributes to prevent hijacking or cross-site leakage.</li>
        </ul>
      </div>

      <div style="margin-top:14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
        <h4 style="font-size:14px; font-weight:700; color:#1f2937; margin-bottom:4px;">5. Grievance Redressal Officer</h4>
        <p style="font-size:12px; line-height:1.5; color:#4b5563; margin:0;">If you have questions, require data access/deletion, or have a grievance, contact our designated officer:</p>
        <div style="font-size:12px; color:#1f2937; margin-top:6px; line-height:1.5;">
          <strong>Designation:</strong> Grievance Redressal Officer<br/>
          <strong>Entity:</strong> Coffee &amp; Cravings<br/>
          <strong>Physical Address:</strong> H4RM+WXF, Mithapur Farm Area, Mithapur, Patna, Bihar 800001, India<br/>
          <strong>Direct Email:</strong> <a href="mailto:founder@coffeeandcravings.in" style="color:#2563eb;">founder@coffeeandcravings.in</a><br/>
          <strong>Phone:</strong> +91 620-567-7925
        </div>
        <p style="font-size:11px; color:#6b7280; margin-top:6px; margin-bottom:0;">All privacy inquiries will be acknowledged promptly and resolved within 30 days.</p>
      </div>
    `;
  } else {
    title.innerText = 'Terms and Conditions';
    body.innerHTML = `
      <p style="font-size:12px; color:#6b7280; margin-bottom:12px;"><strong>Last Updated: May 2026</strong></p>
      <p class="mt-2">By accessing or placing an order with Coffee &amp; Cravings, you agree to these terms:</p>
      <p class="mt-2"><strong>1. Table Dining:</strong> Please ensure you are seated at the designated table number corresponding to your QR code placard for prompt service.</p>
      <p class="mt-2"><strong>2. Payments:</strong> Digital payments are settled instantly via certified UPI. For orders placed with "Pay at Counter (Cash)", payment must be settled directly with the barista before departure.</p>
      <p class="mt-2"><strong>3. Fresh Preparation &amp; Cancellations:</strong> Because our kitchen freshly prepares each handcrafted item upon ticket receipt, changes or cancellations must be requested to the barista immediately before preparation starts.</p>
      <p class="mt-2"><strong>4. Contact &amp; Support:</strong> For assistance or feedback, contact us at <em>founder@coffeeandcravings.in</em> or +91 620-567-7925.</p>
    `;
  }

  modal.classList.add('open');
}

function closePolicyModal() {
  const modal = document.getElementById('policy-modal');
  if (modal) modal.classList.remove('open');
}

// Cookie Banner
function acceptCookies() {
  const banner = document.getElementById('cookie-banner');
  if (banner) banner.classList.add('hidden');
  try {
    localStorage.setItem('cc_cookies_accepted', 'true');
  } catch (e) {}
}

function checkCookiesAccepted() {
  try {
    if (localStorage.getItem('cc_cookies_accepted') === 'true') {
      const banner = document.getElementById('cookie-banner');
      if (banner) banner.classList.add('hidden');
    }
  } catch (e) {}
}

// Mobile Menu
function toggleMobileMenu(force) {
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (!drawer || !overlay) return;

  const isOpen = drawer.classList.contains('open');
  const next = force !== undefined ? force : !isOpen;

  if (next) {
    drawer.classList.add('open');
    overlay.classList.add('open');
  } else {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }
}

// =============================================================================
// 10. MY ORDERS — LIVE ORDER TRACKER & LIFETIME ORDER RECEIPTS
// =============================================================================
const ORDER_STATUS_ICON = {
  awaiting_payment: '⏳',
  new: '🧾',
  preparing: '☕',
  ready: '✅',
  completed: '✓',
  cancelled: '✕'
};
const ORDER_STATUS_COLOR = {
  awaiting_payment: '#d97706',
  new: '#2563eb',
  preparing: '#7c3aed',
  ready: '#059669',
  completed: '#6b7280',
  cancelled: '#dc2626'
};

function renderMyOrdersPage() {
  const isLoggedIn = !!currentCustomerUser;
  let recentList = [];
  try { recentList = JSON.parse(localStorage.getItem('cc_recent_orders') || '[]'); } catch (e) {}
  const hasOrdersScope = isLoggedIn || !!customerPhone || recentList.length > 0;
  const userHeaderHtml = isLoggedIn ? `
    <div style="background:#fff; border-radius:14px; padding:16px 20px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 2px 10px rgba(0,0,0,0.06); border:1px solid #f3f4f6;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:46px; height:46px; border-radius:50%; background:#fef3c7; color:#92400e; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; overflow:hidden;">
          ${currentCustomerUser.photoUrl ? `<img src="${currentCustomerUser.photoUrl}" style="width:100%; height:100%; object-fit:cover;" />` : (currentCustomerUser.name ? currentCustomerUser.name[0].toUpperCase() : '👤')}
        </div>
        <div>
          <div style="font-weight:700; color:#1f2937; font-size:15px;">${currentCustomerUser.name}</div>
          <div style="font-size:12px; color:#6b7280;">${currentCustomerUser.email || (currentCustomerUser.phone ? '+91 ' + currentCustomerUser.phone : 'Signed In')}</div>
        </div>
      </div>
      <button onclick="openCustomerAuthModal()" style="font-size:12px; color:#92400e; background:#fef3c7; border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-weight:600;">Account ▾</button>
    </div>
  ` : `
    <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:12px; padding:12px 16px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <div style="font-size:13px; color:#92400e;">
        <strong>Want to save &amp; view your orders anytime?</strong> Sign in with Google or Phone.
      </div>
      <button onclick="openCustomerAuthModal()" style="background:#92400e; color:#fff; border:none; border-radius:8px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap;">Sign In</button>
    </div>
  `;

  return `
    <section class="my-orders-section">
      <div class="my-orders-container">
        <h2 class="section-title" style="text-align:center; margin-bottom:4px;">📦 My Orders</h2>
        <p style="text-align:center; color:#6b7280; margin-bottom:20px; font-size:14px;">Live updates &amp; complete order receipts</p>

        ${userHeaderHtml}

        <div id="my-orders-phone-form" style="${hasOrdersScope ? 'display:none' : ''}">
          <div style="max-width:360px; margin:0 auto; background:#fff; border-radius:12px; padding:24px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
            <label style="display:block; font-size:14px; font-weight:600; margin-bottom:8px; color:#374151;">📱 Track as Guest with Phone</label>
            <input id="tracker-phone-input" type="tel" inputmode="numeric" placeholder="e.g. 9876543210"
              style="width:100%; border:1.5px solid #d1d5db; border-radius:8px; padding:10px 14px; font-size:15px; outline:none; box-sizing:border-box;" />
            <button onclick="setTrackerPhone()" style="width:100%; margin-top:12px; background:#92400e; color:#fff; border:none; border-radius:8px; padding:12px; font-size:15px; font-weight:600; cursor:pointer;">Track My Orders</button>
          </div>
        </div>

        <div id="my-orders-list" style="${hasOrdersScope ? '' : 'display:none'}">
          ${!isLoggedIn && customerPhone ? `
            <div style="text-align:center; margin-bottom:16px;">
              <span style="font-size:13px; color:#6b7280;">Tracking orders for <strong id="tracker-phone-display">${customerPhone}</strong></span>
              <button onclick="clearTrackerPhone()" style="margin-left:12px; font-size:12px; color:#92400e; background:none; border:none; cursor:pointer; text-decoration:underline;">Change</button>
            </div>
          ` : ''}
          <div id="my-orders-cards" style="max-width:540px; margin:0 auto;">
            <div style="text-align:center; padding:40px; color:#9ca3af;">Loading your orders…</div>
          </div>
          <div style="text-align:center; margin-top:16px;">
            <span id="my-orders-refresh-note" style="font-size:12px; color:#9ca3af;">Auto-refreshes every 8 seconds for active orders</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

function setTrackerPhone() {
  const input = document.getElementById('tracker-phone-input');
  const val = (input ? input.value : '').replace(/[^0-9]/g, '');
  if (val.length < 6) { showToast('Please enter a valid phone number.', 'error'); return; }
  customerPhone = val;
  try { localStorage.setItem('cc_cust_phone', val); } catch (e) {}
  document.getElementById('my-orders-phone-form').style.display = 'none';
  document.getElementById('my-orders-list').style.display = '';
  loadAndRenderMyOrders();
  startMyOrdersPolling();
}

function clearTrackerPhone() {
  customerPhone = '';
  try { localStorage.removeItem('cc_cust_phone'); } catch (e) {}
  if (myOrdersPoller) { clearInterval(myOrdersPoller); myOrdersPoller = null; }
  navigateTo('my-orders');
}

async function loadAndRenderMyOrders() {
  const phoneEl = document.getElementById('tracker-phone-display');
  if (phoneEl && customerPhone) phoneEl.textContent = customerPhone;
  const container = document.getElementById('my-orders-cards');
  if (!container) return;

  let recentList = [];
  try { recentList = JSON.parse(localStorage.getItem('cc_recent_orders') || '[]'); } catch (e) {}

  const params = new URLSearchParams();
  if (customerPhone) params.set('phone', customerPhone);
  if (recentList.length) params.set('recent', recentList.join(','));

  const url = '/api/my-orders' + (params.toString() ? ('?' + params.toString()) : '');
  if (!currentCustomerUser && !customerPhone && !recentList.length) return;

  try {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      container.innerHTML = `<div style="text-align:center; padding:30px; color:#b91c1c;">${d.error || 'Could not load orders.'}</div>`;
      return;
    }
    const { orders } = await r.json();

    if (!orders || !orders.length) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:#9ca3af;">
          <div style="font-size:40px; margin-bottom:12px;">☕</div>
          <p style="margin:0 0 8px; font-weight:600; color:#374151;">No past orders found.</p>
          <p style="margin:0; font-size:13px;">When you place an order, your full receipt &amp; status appear here.</p>
          <button onclick="navigateTo('order')" style="margin-top:16px; background:#92400e; color:#fff; border:none; border-radius:8px; padding:10px 20px; font-size:14px; font-weight:600; cursor:pointer;">Order Now</button>
        </div>`;
      return;
    }

    const hasActiveOrders = orders.some(o => !['completed', 'cancelled'].includes(o.status) && !o.expired);

    container.innerHTML = orders.map(o => {
      const icon = ORDER_STATUS_ICON[o.status] || '•';
      const color = ORDER_STATUS_COLOR[o.status] || '#6b7280';
      const isActive = !['completed', 'cancelled'].includes(o.status) && !o.expired;
      const items = Array.isArray(o.items) ? o.items : [];
      const itemsHtml = items.map(it =>
        `<div style="display:flex; justify-content:space-between; font-size:13px; color:#374151; margin-bottom:4px;">
          <span>${it.qty}× ${it.name}</span>
          <span>₹${(it.price * it.qty).toFixed(2)}</span>
        </div>`
      ).join('');
      const tableLabel = o.table > 0 ? `Table 0${o.table}` : 'Takeaway';
      const payBadge = (o.status === 'cancelled' || o.paymentStatus === 'CANCELLED')
        ? `<span style="background:#fee2e2; color:#991b1b; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:600;">✕ Cancelled</span>`
        : o.paymentStatus === 'PAID'
          ? `<span style="background:#d1fae5; color:#065f46; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:600;">✓ PAID</span>`
          : o.paymentStatus === 'PENDING'
            ? `<span style="background:#fef3c7; color:#92400e; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:600;">⏳ Pending</span>`
            : `<span style="background:#fee2e2; color:#991b1b; border-radius:4px; padding:2px 7px; font-size:11px; font-weight:600;">💵 Pay at counter</span>`;

      const pulseStyle = isActive ? 'animation:pulse-dot 1.4s infinite;' : '';
      const encodedItems = encodeURIComponent(JSON.stringify(items));
      const formattedDate = o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }) : '';

      return `
        <div style="background:#fff; border-radius:14px; box-shadow:0 2px 12px rgba(0,0,0,0.08); margin-bottom:16px; overflow:hidden; border-left:4px solid ${color};">
          <div style="padding:14px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f3f4f6;">
            <div>
              <span style="font-weight:700; color:#1f2937; font-size:15px;">${o.id}</span>
              <span style="margin-left:10px; font-size:12px; color:#6b7280;">${tableLabel}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${payBadge}
            </div>
          </div>
          <div style="padding:12px 16px; background:#fafaf9; border-bottom:1px solid #f3f4f6;">
            ${itemsHtml || '<span style="color:#9ca3af; font-size:13px;">Items not available</span>'}
            ${o.discount > 0 ? `
              <div style="display:flex; justify-content:space-between; font-size:12px; color:#059669; margin-top:4px; border-top:1px dashed #e5e7eb; padding-top:4px;">
                <span>Discount applied</span>
                <span>-₹${Number(o.discount).toFixed(2)}</span>
              </div>
            ` : ''}
          </div>
          <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:22px; ${pulseStyle}">${icon}</span>
              <div>
                <div style="font-weight:700; color:${color}; font-size:14px;">${o.statusLabel || o.status}</div>
                ${o.cancelReason ? `<div style="font-size:12px; color:#ef4444; font-weight:500;">Reason: ${escapeHtml(o.cancelReason)}</div>` : ''}
                <div style="font-size:11px; color:#9ca3af;">${formattedDate}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="text-align:right;">
                <div style="font-weight:700; color:#1f2937; font-size:16px;">₹${Number(o.total).toFixed(2)}</div>
              </div>
              ${items.length ? `
                <button onclick="reorderItems('${encodedItems}')" style="background:#f5f5f4; border:1px solid #d6d3d1; border-radius:8px; padding:6px 10px; font-size:12px; font-weight:600; color:#44403c; cursor:pointer;" title="Add these items to cart again">Re-order</button>
              ` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    // If no active orders, stop aggressive polling
    if (!hasActiveOrders && myOrdersPoller) {
      clearInterval(myOrdersPoller);
      myOrdersPoller = null;
      const note = document.getElementById('my-orders-refresh-note');
      if (note) note.textContent = 'All orders up to date ✓';
    }
  } catch (e) {
    console.error('[My Orders] Load error:', e);
    const container2 = document.getElementById('my-orders-cards');
    if (container2) container2.innerHTML = `<div style="text-align:center; padding:30px; color:#9ca3af;">Could not reach server. Retrying…</div>`;
  }
}

function startMyOrdersPolling() {
  let recentList = [];
  try { recentList = JSON.parse(localStorage.getItem('cc_recent_orders') || '[]'); } catch (e) {}
  if (!currentCustomerUser && !customerPhone && !recentList.length) return;
  loadAndRenderMyOrders(); // immediate load
  if (myOrdersPoller) clearInterval(myOrdersPoller);
  myOrdersPoller = setInterval(loadAndRenderMyOrders, 8000);
}

// =============================================================================
// CUSTOMER AUTHENTICATION (Google 1-Click & Gmail 6-Digit OTP - 100% Free)
// =============================================================================
let activeOtpEmail = '';

async function checkCustomerSession() {
  try {
    const r = await fetch('/api/customer/session');
    if (r.ok) {
      const data = await r.json();
      if (data.loggedIn && data.user) {
        currentCustomerUser = data.user;
        if (data.user.phone && !customerPhone) {
          customerPhone = data.user.phone;
        }
        if (data.user.name && !customerName) {
          customerName = data.user.name;
        }
      } else {
        currentCustomerUser = null;
      }
    }
  } catch (e) {}
  updateCustomerHeaderUI();
}

function updateCustomerHeaderUI() {
  const nameEl = document.getElementById('customer-btn-name');
  const avatarEl = document.getElementById('customer-btn-avatar');
  const mobileLink = document.querySelector('#mobile-auth-item a');
  if (currentCustomerUser) {
    if (nameEl) {
      nameEl.style.display = 'inline';
      nameEl.textContent = currentCustomerUser.name ? currentCustomerUser.name.split(' ')[0] : 'Account';
    }
    if (avatarEl) {
      if (currentCustomerUser.photoUrl) {
        avatarEl.innerHTML = `<img src="${currentCustomerUser.photoUrl}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;" />`;
      } else {
        avatarEl.innerHTML = `<span style="font-weight:700; font-size:13px; color:#92400e;">${(currentCustomerUser.name || 'U')[0].toUpperCase()}</span>`;
      }
    }
    if (mobileLink) {
      mobileLink.textContent = `👤 ${currentCustomerUser.name || 'My Account'}`;
    }
  } else {
    if (nameEl) nameEl.style.display = 'none';
    if (avatarEl) {
      avatarEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
    if (mobileLink) {
      mobileLink.textContent = '👤 Sign In / Account';
    }
  }
}

function handleCustomerAccountClick() {
  openCustomerAuthModal();
}

function openCustomerAuthModal() {
  const modal = document.getElementById('customer-auth-modal');
  if (!modal) return;
  const unauthView = document.getElementById('auth-unauthenticated-view');
  const authView = document.getElementById('auth-authenticated-view');
  const titleEl = document.getElementById('auth-modal-title');
  const msgEl = document.getElementById('auth-status-msg');
  if (msgEl) msgEl.innerText = '';

  if (currentCustomerUser) {
    if (titleEl) titleEl.innerText = 'My Account';
    if (unauthView) unauthView.style.display = 'none';
    if (authView) authView.style.display = 'block';
    const nameEl = document.getElementById('auth-profile-name');
    const emailEl = document.getElementById('auth-profile-email');
    const phoneEl = document.getElementById('auth-profile-phone');
    const avatarEl = document.getElementById('auth-profile-avatar');
    if (nameEl) nameEl.textContent = currentCustomerUser.name || 'Customer';
    if (emailEl) emailEl.textContent = currentCustomerUser.email || '';
    if (phoneEl) phoneEl.textContent = currentCustomerUser.phone ? `+91 ${currentCustomerUser.phone}` : '';
    if (avatarEl) {
      if (currentCustomerUser.photoUrl) {
        avatarEl.innerHTML = `<img src="${currentCustomerUser.photoUrl}" style="width:100%; height:100%; object-fit:cover;" />`;
      } else {
        avatarEl.textContent = (currentCustomerUser.name || 'U')[0].toUpperCase();
      }
    }
  } else {
    if (titleEl) titleEl.innerText = 'Sign In to Coffee & Cravings';
    if (unauthView) unauthView.style.display = 'block';
    if (authView) authView.style.display = 'none';
    resetEmailAuthStep();
    initGoogleAuth();
  }
  modal.classList.add('open');
}

function closeCustomerAuthModal() {
  const modal = document.getElementById('customer-auth-modal');
  if (modal) modal.classList.remove('open');
}

function setAuthStatusMsg(msg, isError = false) {
  const el = document.getElementById('auth-status-msg');
  if (el) {
    el.style.color = isError ? '#b91c1c' : '#059669';
    el.innerText = msg;
  }
}


function showOrderPlacedPopup(orderId, tableNum) {
  const overlay = document.getElementById('order-placed-popup');
  if (!overlay) return;
  const idBadge = document.getElementById('popup-order-badge');
  const tableBadge = document.getElementById('popup-table-badge');
  if (idBadge) idBadge.innerText = orderId ? `#${orderId}` : '';
  if (tableBadge) tableBadge.innerText = tableNum > 0 ? `📍 Table 0${tableNum}` : '🛍️ Takeaway / Counter';
  overlay.style.display = 'flex';
}

function dismissOrderPlacedPopup() {
  const overlay = document.getElementById('order-placed-popup');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease-out';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.style.opacity = '';
    }, 200);
  }
}

// -----------------------------------------------------------------------------
// Google Identity Services (1-Click Google Sign-In - 100% Free Forever)
// -----------------------------------------------------------------------------
function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) return;
  try {
    const clientId = window.GOOGLE_CLIENT_ID || "377404973368-123d5bckj1lehthnjoilnt07udsvnn2m.apps.googleusercontent.com";
  const hasValidClient = clientId && typeof clientId === 'string' && !clientId.includes('dummy') && clientId.endsWith('.apps.googleusercontent.com');
  if (!hasValidClient) {
    const gContainer = document.getElementById('google-signin-btn-container');
    const manualBtn = document.getElementById('google-auth-btn');
    const divider = document.querySelector('.auth-divider');
    if (gContainer) gContainer.style.display = 'none';
    if (manualBtn) manualBtn.style.display = 'none';
    if (divider) divider.style.display = 'none';
    return;
  }
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleAuthCredential,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    const gContainer = document.getElementById('google-signin-btn-container');
    if (gContainer && !gContainer.hasChildNodes()) {
      google.accounts.id.renderButton(gContainer, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 280,
        text: 'continue_with'
      });
      const manualBtn = document.getElementById('google-auth-btn');
      if (manualBtn) manualBtn.style.display = 'none';
    }
  } catch (e) {
    console.warn('Google Auth Init:', e);
  }
}

async function handleGoogleAuthCredential(response) {
  if (!response || !response.credential) return;
  setAuthStatusMsg('Signing in with Google…');
  try {
    const r = await fetch('/api/customer/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Google sign-in failed.');
    await handleLoginSuccess(data.user);
  } catch (err) {
    setAuthStatusMsg(err.message || 'Google sign in failed.', true);
  }
}

async function signInWithGoogle() {
  if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
    try {
      google.accounts.id.prompt();
      return;
    } catch (_) {}
  }
  setAuthStatusMsg('Google 1-Tap is blocked by browser settings or unavailable. Please enter your Gmail below to receive a 6-digit login code!', false);
  const emailInput = document.getElementById('auth-email-input');
  if (emailInput) {
    emailInput.scrollIntoView({ behavior: 'smooth' });
    emailInput.focus();
  }
}

// -----------------------------------------------------------------------------
// Gmail / Email 6-Digit OTP Flow
// -----------------------------------------------------------------------------
async function sendEmailOtp() {
  const input = document.getElementById('auth-email-input');
  const email = (input ? input.value : '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setAuthStatusMsg('Please enter a valid Gmail / Email address.', true);
    return;
  }
  const btn = document.getElementById('send-otp-btn');
  if (btn) { btn.disabled = true; btn.innerText = 'Sending Code…'; }
  setAuthStatusMsg('Generating secure 6-digit code…');

  try {
    const r = await fetch('/api/customer/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', email })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Could not send code.');

    activeOtpEmail = email;
    document.getElementById('email-auth-step1').style.display = 'none';
    document.getElementById('email-auth-step2').style.display = 'block';
    const targetLabel = document.getElementById('email-otp-target-label');
    if (targetLabel) targetLabel.textContent = `We sent a 6-digit code to ${email}`;

    const otpInput = document.getElementById('auth-otp-input');
    if (otpInput) {
      otpInput.value = '';
      otpInput.focus();
    }
    setAuthStatusMsg(data.message || `6-digit verification code sent to ${email}! Check your inbox.`);
  } catch (err) {
    setAuthStatusMsg(err.message || 'Error sending code. Please try again.', true);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Send 6-Digit Code'; }
  }
}

async function verifyEmailOtp() {
  const input = document.getElementById('auth-otp-input');
  const otp = (input ? input.value : '').trim();
  if (!/^\d{6}$/.test(otp)) {
    setAuthStatusMsg('Please enter the full 6-digit code.', true);
    return;
  }
  const btn = document.getElementById('verify-otp-btn');
  if (btn) { btn.disabled = true; btn.innerText = 'Verifying…'; }
  setAuthStatusMsg('Verifying your code…');

  try {
    const r = await fetch('/api/customer/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', email: activeOtpEmail, otp })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Invalid code.');

    await handleLoginSuccess(data.user);
  } catch (err) {
    setAuthStatusMsg(err.message || 'Verification failed. Please try again.', true);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Verify & Sign In'; }
  }
}

function resetEmailAuthStep() {
  const s1 = document.getElementById('email-auth-step1');
  const s2 = document.getElementById('email-auth-step2');
  if (s1) s1.style.display = 'block';
  if (s2) s2.style.display = 'none';
  const otpInput = document.getElementById('auth-otp-input');
  if (otpInput) otpInput.value = '';
  setAuthStatusMsg('');
}

async function handleLoginSuccess(user) {
  currentCustomerUser = user;
  if (user.phone) {
    customerPhone = user.phone;
    try { localStorage.setItem('cc_cust_phone', customerPhone); } catch (e) {}
  }
  if (user.name) {
    customerName = user.name;
    try { localStorage.setItem('cc_cust_name', customerName); } catch (e) {}
  }
  closeCustomerAuthModal();
  updateCustomerHeaderUI();
  showToast(`Welcome, ${user.name || 'Friend'}!`, 'success');

  if (window._pendingCheckout) {
    window._pendingCheckout = false;
    setTimeout(() => {
      openCheckoutModal();
    }, 350);
  } else if (currentView === 'my-orders') {
    navigateTo('my-orders');
  }
}

async function logoutCustomer() {
  try {
    await fetch('/api/customer/session', { method: 'DELETE' });
  } catch (e) {}
  currentCustomerUser = null;
  customerPhone = '';
  try { localStorage.removeItem('cc_cust_phone'); } catch (e) {}
  closeCustomerAuthModal();
  updateCustomerHeaderUI();
  showToast('You have been signed out.', 'success');
  if (currentView === 'my-orders') {
    navigateTo('my-orders');
  }
}



async function deleteCustomerAccount() {
  if (!confirm('Are you sure you want to delete your account and all associated order history? This cannot be undone.')) return;
  try {
    const r = await fetch('/api/customer/session?deleteData=true', { method: 'DELETE' });
    if (r.ok) {
      currentCustomerUser = null;
      customerPhone = '';
      try {
        localStorage.removeItem('cc_cust_phone');
        localStorage.removeItem('cc_recent_orders');
      } catch (e) {}
      closeCustomerAuthModal();
      updateCustomerHeaderUI();
      showToast('Your account and order history have been deleted.', 'info');
      navigateTo('home');
      return;
    }
  } catch (e) {}
  showToast('Could not delete account. Please try again.', 'error');
}

function reorderItems(itemsJson) {
  try {
    const items = typeof itemsJson === 'string' ? JSON.parse(decodeURIComponent(itemsJson)) : itemsJson;
    if (!Array.isArray(items) || !items.length) return;
    for (const it of items) {
      if (it.isFree) continue; // skip promotional freebies
      const existing = cart.find(c => c.id === it.id);
      if (existing) {
        existing.qty += it.qty;
      } else {
        cart.push({ id: it.id, qty: it.qty });
      }
    }
    saveCart();
    updateCartBadge();
    showToast('Items added to your cart!', 'success');
    navigateTo('order');
  } catch (e) {
    showToast('Could not reorder items.', 'error');
  }
}

// Toast System
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

async function handleContactSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const nameInput = form.querySelector('#contact-name') || form.querySelector('input[type="text"]');
  const emailInput = form.querySelector('#contact-email') || form.querySelector('input[type="email"]');
  const msgInput = form.querySelector('#contact-message') || form.querySelector('textarea');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const message = msgInput ? msgInput.value.trim() : '';

  if (!name || !email || !message) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  const origBtnText = btn ? btn.textContent : 'Send Message';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  }

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to send message. Please try again.');
    }
    showToast(data.message || 'Thank you! Your message has been received.', 'success');
    form.reset();
  } catch (err) {
    showToast(err.message || 'Could not send message. Please try again.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origBtnText;
    }
  }
}

// =============================================================================
// 11. INITIALIZATION ON DOM READY
// =============================================================================
// Menu, prices and availability come from the server (owner edits show up instantly). menu-data.js is only the fallback.
async function loadLiveMenu() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('/api/config', { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return;
    const c = await r.json();
    gatewayOn = !!c.gateway;
    if (Array.isArray(c.menu)) MENU_ITEMS.splice(0, MENU_ITEMS.length, ...c.menu);
    if (Array.isArray(c.deals)) activeDeals = c.deals;
    const before = cart.length;
    cart = cart.filter(l => MENU_ITEMS.some(m => m.id === l.id)); // product removed/hidden meanwhile
    if (cart.length !== before) saveCart();
  } catch (e) { /* offline or slow: keep the built-in menu */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  initStorage();
  await checkCustomerSession();
  await loadLiveMenu();
  checkCookiesAccepted();
  updateCartBadge();

  // Scroll effect on header
  window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (header) {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  // Determine starting route: check pathname first, then hash, default to 'home'
  let initialRoute = window.location.hash.replace('#', '');
  if (!initialRoute) {
    const p = window.location.pathname.replace(/^\/|\/$/g, '');
    if (['order', 'story', 'gallery', 'contact', 'my-orders'].includes(p)) {
      initialRoute = p;
    }
  }
  navigateTo(initialRoute || 'home');
});
