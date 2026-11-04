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
let currentView = 'home';
let currentTableSig = '';
let orderSubmitting = false;
let gatewayOn = false;
let appliedCoupon = null; // rule returned by /api/config?coupon=CODE

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

async function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const msg = document.getElementById('coupon-msg');
  const code = (input.value || '').trim();
  if (!code) return;
  msg.style.color = '#555'; msg.innerText = 'Checking…';
  try {
    const r = await fetch('/api/config?coupon=' + encodeURIComponent(code));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Could not check the coupon.');
    appliedCoupon = d.coupon;
    renderCartDrawer();
  } catch (e) {
    appliedCoupon = null; renderCartDrawer();
    msg.style.color = '#b91c1c'; msg.innerText = e.message;
  }
}
function removeCoupon() { appliedCoupon = null; renderCartDrawer(); }
let orderKey = null;
let currentTable = 0; // 0 = Walk-in/takeaway, 1-12 = Table number
let cart = []; // [{ id, qty, note }]
let currentPaymentMethod = 'digital'; // 'digital' (UPI) or 'counter' (Cash)
let orderSearchFilter = '';
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
    const p = new URLSearchParams(window.location.search);
    const t = parseInt(p.get('table'), 10);
    const sig = p.get('sig');
    if (t >= 1 && t <= 12 && sig) {
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
        ${featured.map(item => `
          <div class="product-card">
            <div class="product-img-box">
              <img src="${item.image}" alt="${item.name}" class="product-img" loading="lazy" />
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
        `).join('')}
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

  const CAT_LABELS = { coffee: 'Coffee', frappes: 'Frappes & Coolers', pastas: 'Pastas & Snacks', burgers: 'Burgers & Fries' };
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

        <div class="mt-3 p-3" style="background:#fff; border:1px solid #e5e7eb; border-radius:4px; font-size:12px;">
          <strong>📱 Table QR Ordering:</strong>
          <p class="text-muted mt-1" style="font-size:12px; color:#666;">
            Currently ordering for: <br/>
            <span style="font-weight:700; color:#1a1a1a;">
              ${currentTable > 0 ? `Table 0${currentTable}` : 'Takeaway / Counter'}
            </span>
          </p>
          <button class="btn-godaddy-outline mt-2 full-width" style="padding:6px; font-size:10px;" onclick="openTablePickerModal()">
            Switch Table
          </button>
        </div>
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
          ` : filteredItems.map(item => `
            <div class="product-card">
              <div class="product-img-box">
                <img src="${item.image}" alt="${item.name}" class="product-img" loading="lazy" />
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
          `).join('')}
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
            <img src="${item.image}" alt="${item.name}" class="product-img" loading="lazy" />
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

    return `
      <div class="cart-item-row">
        <img src="${product.image}" alt="${product.name}" class="cart-item-img" />
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
    `;
  }).join('');

  container.innerHTML = itemsHtml;

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
  orderSubmitting = true;

  const custName = document.getElementById('cust-name-input')?.value.trim() || 'Guest';
  const custPhone = document.getElementById('cust-phone-input')?.value.trim() || '';
  const specialNotes = document.getElementById('order-special-notes')?.value.trim() || '';
  if (!orderKey) orderKey = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2);

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

  const orderId = order.id;
  const orderItems = order.items;
  const grandTotal = order.total;

  // Play audio chime
  playChimeSound();

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
}

// =============================================================================
// 9. TABLE PICKER MODAL
// =============================================================================
function openTablePickerModal() {
  const modal = document.getElementById('table-picker-modal');
  if (modal) modal.classList.add('open');
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
    textEl.innerText = currentTable > 0 ? `Table 0${currentTable}` : 'Table: Walk-in / Takeaway';
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
        <img src="${item.image}" alt="${item.name}" style="width:48px; height:48px; border-radius:4px; object-fit:cover;" />
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
      <p><strong>Last Updated: 2024</strong></p>
      <p class="mt-2">Welcome to Coffee &amp; Cravings. We respect your privacy and are committed to protecting your personal data.</p>
      <p class="mt-2"><strong>1. Information We Collect:</strong> When you place a table order, we may collect your name, phone number, table number, and dietary instructions solely to prepare and deliver your orders accurately.</p>
      <p class="mt-2"><strong>2. Payment Security:</strong> Digital UPI payments are processed securely through certified UPI payment gateways. We never store debit or credit card CVV numbers.</p>
      <p class="mt-2"><strong>3. Contact:</strong> If you have any questions, reach out to us at <em>founder@coffeeandcravings.in</em>.</p>
    `;
  } else {
    title.innerText = 'Terms and Conditions';
    body.innerHTML = `
      <p><strong>Last Updated: 2024</strong></p>
      <p class="mt-2">By accessing or placing an order on Coffee &amp; Cravings, you agree to these terms:</p>
      <p class="mt-2"><strong>1. Table Dining:</strong> Please ensure you are seated at the designated table number corresponding to your QR code.</p>
      <p class="mt-2"><strong>2. Counter Payments:</strong> For orders placed with "Pay at Counter (Cash)", payment must be settled directly with the barista.</p>
      <p class="mt-2"><strong>3. Cancellations:</strong> Because our kitchen freshly prepares each handcrafted item upon ticket receipt, changes should be requested to the barista immediately.</p>
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

function handleContactSubmit(e) {
  e.preventDefault();
  showToast('Thank you! Your message has been sent to founder@coffeeandcravings.in', 'success');
  e.target.reset();
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
    const before = cart.length;
    cart = cart.filter(l => MENU_ITEMS.some(m => m.id === l.id)); // product removed/hidden meanwhile
    if (cart.length !== before) saveCart();
  } catch (e) { /* offline or slow: keep the built-in menu */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  initStorage();
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

  // Determine starting route
  const hash = window.location.hash.replace('#', '') || 'home';
  navigateTo(hash);
});
