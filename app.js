/**
 * Coffee & Cravings — Application Logic
 * Replicating GoDaddy site 1:1 + QR Table Ordering + Live Barista KDS
 */

// =============================================================================
// 1. MENU CATALOG (Exact Products & Prices from Coffee & Cravings GoDaddy Store)
// =============================================================================
const MENU_ITEMS = [
  // COFFEE (HOT & ICED)
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Dark, rich espresso lying under a smoothed and stretched layer of thick milk foam.',
    image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: true
  },
  {
    id: 'americano',
    name: 'Americano',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Espresso shots topped with hot water create a light layer of crema culminating in this wonderfully rich cup.',
    image: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&w=700&q=80',
    badge: 'Classic',
    featured: true
  },
  {
    id: 'caffe-mocha',
    name: 'Caffé Mocha',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 159,
    description: 'Comforting mocha sauce and espresso meet steamed milk with delicate foam.',
    image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=700&q=80',
    badge: 'Bestseller',
    featured: true
  },
  {
    id: 'caffe-latte',
    name: 'Caffé Latte',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Rich, full-bodied espresso in steamed milk, lightly topped with velvety foam.',
    image: 'https://images.unsplash.com/photo-1561047029-3000c68339ca?auto=format&fit=crop&w=700&q=80',
    badge: '',
    featured: true
  },
  {
    id: 'latte-macchiato',
    name: 'Latte Macchiato',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 110,
    description: 'Steamed milk with marked espresso shots, creating layers of flavor.',
    image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=700&q=80',
    badge: 'Value',
    featured: true
  },
  {
    id: 'iced-latte',
    name: 'Iced Latte',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Chilled espresso combined with milk and poured over ice.',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=700&q=80',
    badge: 'Chilled',
    featured: false
  },
  {
    id: 'irish-latte',
    name: 'Irish Latte',
    category: 'coffee',
    categoryName: 'Coffee (Hot & Iced)',
    price: 129,
    description: 'Aromatic espresso infused with non-alcoholic Irish cream notes and warm velvety milk.',
    image: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=700&q=80',
    badge: 'Specialty',
    featured: false
  },

  // FRAPPES & COOLERS
  {
    id: 'hazelnut-frappe',
    name: 'Hazelnut Frappe',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 159,
    description: 'Blended roasted hazelnut syrup, chilled espresso, creamy milk and ice topped with whipped delight.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=700&q=80',
    badge: 'Signature',
    featured: true
  },
  {
    id: 'caramel-frappe',
    name: 'Caramel Frappe',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 139,
    description: 'Buttery caramel syrup blended with coffee, milk and ice with golden drizzle.',
    image: 'https://images.unsplash.com/photo-1589396575653-c09c794ff6a6?auto=format&fit=crop&w=700&q=80',
    badge: 'Popular',
    featured: false
  },
  {
    id: 'french-vanilla-frappe',
    name: 'French Vanilla Frappe',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 139,
    description: 'Fragrant French vanilla blended cold with creamy milk and coffee.',
    image: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=700&q=80',
    badge: '',
    featured: false
  },
  {
    id: 'choco-bin-laden',
    name: 'Choco Bin Laden',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 179,
    description: 'Our explosive chocolate explosion frappe packed with brownies, dark chocolate chips, and thick fudge sauce.',
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=700&q=80',
    badge: 'Cafe Legend',
    featured: true
  },
  {
    id: 'spicy-lemonade',
    name: 'Spicy Lemonade',
    category: 'frappes',
    categoryName: 'Frappes & Coolers',
    price: 99,
    description: 'Tangy fresh squeezed lemon cooler with a hint of roasted cumin, mint, and desi spices.',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=700&q=80',
    badge: 'Refreshing',
    featured: false
  },

  // PASTAS & SNACKS
  {
    id: 'creamy-alfredo-pasta',
    name: 'Creamy Alfredo Pasta',
    category: 'pastas',
    categoryName: 'Pastas & Snacks',
    price: 219,
    description: 'Tender penne pasta tossed in our chef’s signature velvety parmesan cheese cream sauce with black olives and herbs.',
    image: 'https://i.vimeocdn.com/video/1972773852-c462373ce16cfc72992424520d893639a8402099a84c3667279fddacc986d86f-d_1920x1080?r=pad',
    badge: 'House Special',
    featured: true
  },
  {
    id: 'paneer-makhani',
    name: 'Paneer Makhani',
    category: 'pastas',
    categoryName: 'Pastas & Snacks',
    price: 269,
    description: 'Succulent cubes of cottage cheese prepared in a rich, velvety butter-tomato gravy with Indian spices.',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=700&q=80',
    badge: 'Gourmet',
    featured: false
  },
  {
    id: 'club-sandwich',
    name: 'Club Sandwich',
    category: 'pastas',
    categoryName: 'Pastas & Snacks',
    price: 149,
    description: 'Triple-decker toasted bread filled with fresh crisp garden greens, cheese slice, and creamy herb dressing.',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=700&q=80',
    badge: '',
    featured: false
  },

  // BURGERS & FRIES
  {
    id: 'classic-veg-burger',
    name: 'Classic Veg Burger',
    category: 'burgers',
    categoryName: 'Burgers & Fries',
    price: 69,
    description: 'Golden spiced potato and vegetable patty in a toasted sesame bun with lettuce and mayo.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',
    badge: 'Bestseller',
    featured: false
  },
  {
    id: 'patted-paneer-burger',
    name: 'Patted Paneer Burger',
    category: 'burgers',
    categoryName: 'Burgers & Fries',
    price: 119,
    description: 'Crispy seasoned paneer patty topped with melted cheddar, crunchy onions, and zesty secret sauce.',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80',
    badge: 'Chef Choice',
    featured: true
  },
  {
    id: 'salted-french-fries',
    name: 'Salted French Fries',
    category: 'burgers',
    categoryName: 'Burgers & Fries',
    price: 59,
    description: 'Golden potato fries fried to perfection and dusted with sea salt.',
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=700&q=80',
    badge: '',
    featured: false
  },
  {
    id: 'peri-peri-fries',
    name: 'Peri Peri Fries',
    category: 'burgers',
    categoryName: 'Burgers & Fries',
    price: 79,
    description: 'Crispy crinkle-cut fries tossed vigorously in our bold and spicy peri-peri dust.',
    image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=700&q=80',
    badge: 'Spicy',
    featured: false
  }
];

// =============================================================================
// 2. STATE MANAGEMENT & LOCAL STORAGE
// =============================================================================
let currentView = 'home';
let currentTable = 0; // 0 = Walk-in/takeaway, 1-12 = Table number
let cart = []; // [{ id, qty, note }]
let currentPaymentMethod = 'digital'; // 'digital' (UPI) or 'counter' (Cash)
let orderSearchFilter = '';
let orderCategoryFilter = 'all';
let orderSortFilter = 'popular';
let selectedQrPlacardTable = 1;
let kdsFilter = 'all';

// Load stored cart & table from localStorage
function initStorage() {
  try {
    const savedCart = localStorage.getItem('cc_cart');
    if (savedCart) cart = JSON.parse(savedCart);

    const savedTable = localStorage.getItem('cc_table');
    if (savedTable) currentTable = parseInt(savedTable, 10) || 0;

    // Check URL parameters for table: e.g. ?table=4
    const urlParams = new URLSearchParams(window.location.search);
    const tableParam = urlParams.get('table');
    if (tableParam) {
      currentTable = parseInt(tableParam, 10) || 0;
      localStorage.setItem('cc_table', currentTable);
    }
  } catch (e) {
    console.error('Storage error', e);
  }
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

// Initial orders seed for Barista KDS if none exists
function initSampleOrders() {
  if (!localStorage.getItem('cc_orders')) {
    const initialOrders = [
      {
        id: 'CC-1021',
        table: 2,
        customerName: 'Aarav Patel',
        phone: '9823411223',
        paymentMethod: 'counter',
        paymentStatus: 'UNPAID', // Barista must collect cash!
        specialNotes: 'Extra hot coffee please',
        items: [
          { id: 'cappuccino', name: 'Cappuccino', qty: 2, price: 129 },
          { id: 'salted-french-fries', name: 'Salted French Fries', qty: 1, price: 59 }
        ],
        subtotal: 317,
        tax: 15.85,
        total: 332.85,
        status: 'new', // 'new' | 'preparing' | 'ready' | 'completed'
        createdAt: new Date(Date.now() - 6 * 60000).toISOString()
      },
      {
        id: 'CC-1020',
        table: 4,
        customerName: 'Priya Verma',
        phone: '9934102948',
        paymentMethod: 'digital',
        paymentStatus: 'PAID',
        specialNotes: 'Mild spice on pasta',
        items: [
          { id: 'creamy-alfredo-pasta', name: 'Creamy Alfredo Pasta', qty: 1, price: 219 },
          { id: 'hazelnut-frappe', name: 'Hazelnut Frappe', qty: 1, price: 159 }
        ],
        subtotal: 378,
        tax: 18.9,
        total: 396.9,
        status: 'preparing',
        createdAt: new Date(Date.now() - 14 * 60000).toISOString()
      }
    ];
    localStorage.setItem('cc_orders', JSON.stringify(initialOrders));
  }
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
    case 'qr-tables':
      appContainer.innerHTML = renderQrTablesPage();
      generatePlacardQr(selectedQrPlacardTable);
      break;
    case 'barista-kds':
      appContainer.innerHTML = renderBaristaKdsPage();
      renderKdsOrders();
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

// Listen to storage events for real-time synchronization between Barista KDS and Customer orders!
window.addEventListener('storage', (e) => {
  if (e.key === 'cc_orders') {
    if (currentView === 'barista-kds') {
      renderKdsOrders();
      playChimeSound();
    }
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

  const categories = [
    { key: 'all', name: 'All Products', count: MENU_ITEMS.length },
    { key: 'coffee', name: 'Coffee', count: MENU_ITEMS.filter(i => i.category === 'coffee').length },
    { key: 'frappes', name: 'Frappes & Coolers', count: MENU_ITEMS.filter(i => i.category === 'frappes').length },
    { key: 'pastas', name: 'Pastas & Snacks', count: MENU_ITEMS.filter(i => i.category === 'pastas').length },
    { key: 'burgers', name: 'Burgers & Fries', count: MENU_ITEMS.filter(i => i.category === 'burgers').length }
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
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => `
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
              ${getTableTargetUrl(selectedQrPlacardTable)}
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

function getTableTargetUrl(tableNum) {
  const base = window.location.href.split('?')[0].split('#')[0];
  return `${base}?table=${tableNum}#order`;
}

function selectPlacardTable(tableNum) {
  selectedQrPlacardTable = tableNum;
  // Re-render QR
  document.querySelectorAll('.qr-table-chip').forEach((btn, idx) => {
    btn.classList.toggle('selected', idx + 1 === tableNum);
  });
  const title = document.getElementById('placard-table-title');
  if (title) title.innerText = `TABLE ${tableNum < 10 ? '0' + tableNum : tableNum}`;
  const urlEl = document.getElementById('placard-target-url');
  if (urlEl) urlEl.innerText = getTableTargetUrl(tableNum);
  generatePlacardQr(tableNum);
}

function generatePlacardQr(tableNum) {
  const container = document.getElementById('placard-qr-container');
  if (!container) return;
  container.innerHTML = '';
  const url = getTableTargetUrl(tableNum);
  new QRCode(container, {
    text: url,
    width: 156,
    height: 156,
    colorDark: '#1a1a1a',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}

function simulateTableScan(tableNum) {
  saveTable(tableNum);
  showToast(`Simulated scan: Seated at Table 0${tableNum}!`, 'success');
  navigateTo('order');
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
          <button class="btn-godaddy-outline" style="font-size:12px; padding:8px 16px;" onclick="openWalkinOrderModal()">
            + Walk-in Order
          </button>
          <button class="btn-godaddy-dark" style="font-size:12px; padding:8px 16px;" onclick="renderKdsOrders(); playChimeSound();">
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

function getStoredOrders() {
  try {
    const raw = localStorage.getItem('cc_orders');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredOrders(orders) {
  try {
    localStorage.setItem('cc_orders', JSON.stringify(orders));
  } catch (e) {}
}

function renderKdsOrders() {
  const grid = document.getElementById('kds-orders-grid');
  const statsRow = document.getElementById('kds-stats-row');
  if (!grid || !statsRow) return;

  const allOrders = getStoredOrders();

  // Calculate statistics
  const activeCount = allOrders.filter(o => o.status !== 'completed').length;
  const prepCount = allOrders.filter(o => o.status === 'preparing').length;
  const unpaidCounterCount = allOrders.filter(o => o.paymentMethod === 'counter' && o.paymentStatus === 'UNPAID').length;
  const totalSales = allOrders.reduce((sum, o) => sum + (o.total || 0), 0);

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
    const isUnpaid = order.paymentMethod === 'counter' && order.paymentStatus === 'UNPAID';
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
              ${order.customerName ? order.customerName : 'Guest'} 
              ${order.phone ? `(${order.phone})` : ''}
            </div>
          </div>
          <div class="kds-order-meta">
            <strong>${order.id}</strong>
            <div>${timeText}</div>
          </div>
        </div>

        <!-- Payment Status Badge -->
        <div>
          ${isUnpaid ? `
            <span class="kds-payment-tag unpaid-counter">
              ⚠️ COLLECT CASH: ₹${order.total.toFixed(2)}
              <button class="btn-mark-paid-inline" onclick="markOrderPaid('${order.id}')">MARK PAID</button>
            </span>
          ` : `
            <span class="kds-payment-tag paid-digital">
              ✓ PAID (Digital UPI): ₹${order.total.toFixed(2)}
            </span>
          `}
        </div>

        <!-- Special Instructions from Table Customer -->
        ${order.specialNotes ? `
          <div class="kds-special-note-box">
            <strong>📝 Customer Note:</strong> “${order.specialNotes}”
          </div>
        ` : ''}

        <!-- Items Ordered -->
        <div class="kds-items-list">
          ${order.items.map(it => `
            <div class="kds-item-row">
              <div>
                <span class="kds-item-qty">${it.qty}x</span>
                <span>${it.name}</span>
              </div>
              <span style="font-size:13px; font-weight:600;">₹${(it.price * it.qty).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>

        <!-- Status Actions -->
        <div class="kds-actions-row">
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
          ` : `
            <span style="font-size:12px; color:#10b981; font-weight:600;">✓ Completed &amp; Served</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function updateOrderStatus(orderId, newStatus) {
  const orders = getStoredOrders();
  const target = orders.find(o => o.id === orderId);
  if (target) {
    target.status = newStatus;
    saveStoredOrders(orders);
    renderKdsOrders();
    showToast(`Order ${orderId} marked as ${newStatus.toUpperCase()}`, 'success');
  }
}

function markOrderPaid(orderId) {
  const orders = getStoredOrders();
  const target = orders.find(o => o.id === orderId);
  if (target) {
    target.paymentStatus = 'PAID';
    saveStoredOrders(orders);
    renderKdsOrders();
    showToast(`Cash collected for order ${orderId}! Marked as PAID.`, 'success');
  }
}

function openWalkinOrderModal() {
  const table = prompt('Enter Table Number (1-12) or 0 for Takeaway:', '1');
  if (table === null) return;
  const num = parseInt(table, 10) || 0;
  
  // Create quick order for Cappuccino & Alfredo Pasta
  const newOrder = {
    id: 'CC-' + Math.floor(1000 + Math.random() * 9000),
    table: num,
    customerName: 'Walk-in Guest',
    phone: '',
    paymentMethod: 'counter',
    paymentStatus: 'PAID',
    specialNotes: 'Staff manual ticket',
    items: [
      { id: 'cappuccino', name: 'Cappuccino', qty: 1, price: 129 },
      { id: 'creamy-alfredo-pasta', name: 'Creamy Alfredo Pasta', qty: 1, price: 219 }
    ],
    subtotal: 348,
    tax: 17.4,
    total: 365.4,
    status: 'new',
    createdAt: new Date().toISOString()
  };

  const orders = getStoredOrders();
  orders.unshift(newOrder);
  saveStoredOrders(orders);
  renderKdsOrders();
  playChimeSound();
  showToast('Walk-in order created!', 'success');
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

  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;

  const subtotalEl = document.getElementById('cart-subtotal');
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
  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;

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
    if (confirmBtn) confirmBtn.innerText = 'I Have Paid Online — Confirm Table Order';
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

function submitFinalOrder() {
  if (cart.length === 0) return;

  const custName = document.getElementById('cust-name-input')?.value.trim() || 'Guest';
  const custPhone = document.getElementById('cust-phone-input')?.value.trim() || '';
  const specialNotes = document.getElementById('order-special-notes')?.value.trim() || '';

  let subtotal = 0;
  const orderItems = [];

  cart.forEach(c => {
    const p = MENU_ITEMS.find(m => m.id === c.id);
    if (p) {
      subtotal += p.price * c.qty;
      orderItems.push({
        id: p.id,
        name: p.name,
        qty: c.qty,
        price: p.price
      });
    }
  });

  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;

  const orderId = 'CC-' + Math.floor(1000 + Math.random() * 9000);
  const paymentStatus = currentPaymentMethod === 'digital' ? 'PAID' : 'UNPAID';

  const newOrder = {
    id: orderId,
    table: currentTable,
    customerName: custName,
    phone: custPhone,
    paymentMethod: currentPaymentMethod,
    paymentStatus: paymentStatus,
    specialNotes: specialNotes,
    items: orderItems,
    subtotal: subtotal,
    tax: tax,
    total: grandTotal,
    status: 'new',
    createdAt: new Date().toISOString()
  };

  // Persist order to CC_ORDERS
  const orders = getStoredOrders();
  orders.unshift(newOrder);
  saveStoredOrders(orders);

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
      if (currentPaymentMethod === 'digital') {
        payStatusEl.innerHTML = `<span class="badge-rec" style="font-size:12px; padding:4px 8px;">✓ PAID: Digital UPI</span>`;
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

function openAccountModal() {
  alert(`Coffee & Cravings Account\n\nSigned in as: founder@coffeeandcravings.in\nRole: Store Admin & Barista Manager\n\nYou can access the Barista KDS directly from the top bar!`);
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
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  initSampleOrders();
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
