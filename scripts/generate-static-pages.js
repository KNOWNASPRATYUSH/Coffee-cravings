'use strict';
const fs = require('fs');
const path = require('path');
const MENU_ITEMS = require('../menu-data.js');

const master = fs.readFileSync('index.html', 'utf8');

// Function to generate pre-rendered Order page HTML
function buildOrderContent() {
  const categories = [
    { key: 'all', name: 'All Products' },
    { key: 'coffee', name: 'Coffee' },
    { key: 'frappes', name: 'Frappe & Iced' },
    { key: 'hot-chocolate', name: 'Hot Chocolates' },
    { key: 'classic-shakes', name: 'Classic Shakes' },
    { key: 'premium-shakes', name: 'Premium Shakes' },
    { key: 'mocktails', name: 'Mocktails' },
    { key: 'burgers', name: 'Burgers & Sandwiches' },
    { key: 'pasta', name: 'Pasta' },
    { key: 'pizza', name: 'Pizza' },
    { key: 'fries-sides', name: 'Fries & Sides' },
    { key: 'waffles', name: 'Belgian Waffles' },
    { key: 'desserts', name: 'Desserts' },
    { key: 'budget-meals', name: 'Budget Meals' },
    { key: 'add-ons', name: 'Add-Ons' }
  ];

  let catButtons = categories.map(c => `
    <button class="cat-pill ${c.key === 'all' ? 'active' : ''}" data-cat="${c.key}" onclick="filterCategory('${c.key}')">
      ${c.name}
    </button>
  `).join('');

  let cards = MENU_ITEMS.map(item => `
    <article class="godaddy-product-card" data-id="${item.id}" data-category="${item.category}">
      <div class="card-img-wrapper">
        <img src="${item.image}" alt="${item.name} at Coffee & Cravings Patna" loading="lazy" class="product-img" />
        ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ''}
      </div>
      <div class="card-details">
        <div class="card-title-row">
          <h2 class="product-title" style="font-size:16px; margin:0;">${item.name}</h2>
          <span class="product-price">₹${item.price}</span>
        </div>
        <p class="product-desc">${item.description}</p>
        <button class="btn-godaddy-dark add-to-cart-btn" onclick="addToCart('${item.id}')">Add to Cart</button>
      </div>
    </article>
  `).join('\n');

  return `
    <div class="order-page-banner">
      <img src="https://images.unsplash.com/photo-1509785307050-d4066910ec1e?auto=format&fit=crop&w=1500&q=80" alt="Latte Art Banner at Coffee & Cravings Patna" class="order-banner-bg" />
      <div class="order-banner-overlay">
        <span class="section-label-top" style="color: #f5eedb;">FRESHLY CRAFTED</span>
        <h1 class="section-heading-serif" style="color: #fff; font-size: 38px;">Our Artisan Menu &amp; Online Order</h1>
        <p class="story-text" style="color: #f1e9dd; max-width: 650px; margin: 0 auto;">
          Browse 80+ handcrafted specialty coffees, Italian pastas, burgers, and Belgian waffles. Order directly to your table or takeaway in Mithapur, Patna.
        </p>
      </div>
    </div>
    <div class="order-layout-container" style="max-width: 1200px; margin: 30px auto; padding: 0 20px;">
      <div class="category-scroll-bar" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:12px; margin-bottom:24px;">
        ${catButtons}
      </div>
      <div class="products-grid" id="menu-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:20px;">
        ${cards}
      </div>
    </div>
  `;
}

// Function to generate pre-rendered Story page HTML
function buildStoryContent() {
  return `
    <div style="max-width: 1100px; margin: 40px auto; padding: 0 24px;">
      <div class="story-grid" style="display:flex; flex-wrap:wrap; gap:40px; align-items:center;">
        <div class="story-logo-col" style="flex:1; min-width:300px; text-align:center;">
          <img 
            src="https://img1.wsimg.com/isteam/ip/97d5fc10-c530-4d76-9943-c97aa772d128/Coffee%20%26%20Cravings%20logo%203.jpg/:/cr=t:14.91%25,l:0%25,w:100%25,h:48.65%25/rs=w:600,h:451,cg:true" 
            alt="Coffee & Cravings Logo - Patna" 
            class="story-logo-img"
            style="max-width:100%; border-radius:12px; box-shadow:0 4px 14px rgba(0,0,0,0.08);"
          />
        </div>
        <div class="story-content-col" style="flex:1.5; min-width:320px;">
          <span class="section-label-top" style="color:#8c6d46; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">OUR HERITAGE</span>
          <h1 class="section-heading-serif" style="font-size:36px; margin:8px 0 16px; color:#1a1a1a;">Our Story &amp; Passion for Coffee</h1>
          <p class="story-text" style="font-size:16px; line-height:1.7; color:#444; margin-bottom:16px;">
            At <strong>Coffee &amp; Cravings</strong>, we believe that great coffee and wholesome food are more than just a treat—they are an experience, a moment to savor, and a beautiful way to connect with people in Patna.
          </p>
          <p class="story-text" style="font-size:16px; line-height:1.7; color:#444; margin-bottom:16px;">
            Our journey began with a simple passion: to bring genuine third-wave artisan coffee to Mithapur, Patna. Sourcing 100% Arabica estate beans, roasting them with precision, and serving velvety cappuccinos, bold cold brews, and creamy authentic Italian pastas crafted from scratch.
          </p>
          <p class="story-text" style="font-size:16px; line-height:1.7; color:#444;">
            Whether you are catching up with close friends, going on an intimate date, or working remotely on your laptop with our high-speed Wi-Fi, Coffee &amp; Cravings welcomes you like home.
          </p>
        </div>
      </div>
    </div>
  `;
}

// Function to generate pre-rendered Gallery page HTML
function buildGalleryContent() {
  const galleryImages = [
    { url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80', title: 'Aesthetic Cafe Interiors & Cozy Booths' },
    { url: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?auto=format&fit=crop&w=800&q=80', title: 'Barista Handcrafted Latte Art' },
    { url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80', title: 'Belgian Chocolate Therapy Waffles' },
    { url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281744?auto=format&fit=crop&w=800&q=80', title: 'Authentic Penne Alfredo Italian Pasta' },
    { url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80', title: 'Juicy Gourmet Cravings Special Burger' },
    { url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80', title: 'Ambient Evening Seating for Couples & Friends' }
  ];

  let items = galleryImages.map(img => `
    <figure style="margin:0; overflow:hidden; border-radius:10px; box-shadow:0 3px 10px rgba(0,0,0,0.06);">
      <img src="${img.url}" alt="${img.title} - Coffee & Cravings Patna" loading="lazy" style="width:100%; height:260px; object-fit:cover; display:block;" />
      <figcaption style="padding:10px 14px; background:#fff; font-size:13px; font-weight:600; color:#374151;">${img.title}</figcaption>
    </figure>
  `).join('\n');

  return `
    <div style="max-width: 1200px; margin: 40px auto; padding: 0 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <span class="section-label-top" style="color:#8c6d46; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">VISUAL MOMENTS</span>
        <h1 class="section-heading-serif" style="font-size:36px; margin:8px 0 12px; color:#1a1a1a;">Delightful Moments at Coffee &amp; Cravings</h1>
        <p class="story-text" style="max-width: 650px; margin: 0 auto; font-size:16px; color:#555;">
          Step inside Patna's coziest artisan coffee shop. Explore our welcoming atmosphere, signature dishes, handcrafted brews, and candid memories.
        </p>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:24px;">
        ${items}
      </div>
    </div>
  `;
}

// Function to generate pre-rendered Contact page HTML
function buildContactContent() {
  return `
    <div style="max-width: 1100px; margin: 40px auto; padding: 0 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <span class="section-label-top" style="color:#8c6d46; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">VISIT US IN PATNA</span>
        <h1 class="section-heading-serif" style="font-size:36px; margin:8px 0 12px; color:#1a1a1a;">Contact Us, Location &amp; Hours</h1>
        <p class="story-text" style="max-width: 600px; margin: 0 auto; font-size:16px; color:#555;">
          Have questions, table booking inquiries, or catering requests? We would love to hear from you.
        </p>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:32px;">
        <div style="background:#fff; padding:28px; border-radius:12px; border:1px solid #e5e7eb; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          <h2 class="section-heading-serif" style="font-size:24px; margin-bottom:16px; color:#111827;">Get in Touch</h2>
          <div style="display:flex; flex-direction:column; gap:16px; font-size:15px; color:#374151;">
            <div>
              <strong>📍 Exact Address:</strong><br />
              Coffee &amp; Cravings, H4RM+WXF, Mithapur Farm Area, Mithapur, Patna, Bihar 800001, India
            </div>
            <div>
              <strong>🏛️ Landmark:</strong><br />
              Near Chanakya National Law University (CNLU) and Mithapur Bus Stand (7 mins from Patna Junction)
            </div>
            <div>
              <strong>📞 Direct Phone:</strong><br />
              <a href="tel:6205677925" style="color:#78350f; font-weight:700; text-decoration:underline;">620-567-7925</a> / +91 6205677925
            </div>
            <div>
              <strong>✉️ Email Address:</strong><br />
              <a href="mailto:founder@coffeeandcravings.in" style="color:#78350f; text-decoration:underline;">founder@coffeeandcravings.in</a>
            </div>
            <div>
              <strong>🕒 Operating Hours:</strong><br />
              Monday – Sunday: <strong>10:30 AM to 10:00 PM</strong> (Open 7 days a week)
            </div>
          </div>
        </div>

        <div style="background:#fff; padding:28px; border-radius:12px; border:1px solid #e5e7eb; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          <h2 class="section-heading-serif" style="font-size:24px; margin-bottom:16px; color:#111827;">Send an Inquiry</h2>
          <form onsubmit="handleContactSubmit(event)" style="display:flex; flex-direction:column; gap:14px;">
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Your Name:</label>
              <input type="text" id="contact-name" required placeholder="e.g. Rahul Sharma" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:6px; font-size:14px;" />
            </div>
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Phone / Email:</label>
              <input type="text" id="contact-phone" required placeholder="Phone number or Email" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:6px; font-size:14px;" />
            </div>
            <div>
              <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:4px;">Your Message:</label>
              <textarea id="contact-message" required rows="4" placeholder="How can we help you?" style="width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:6px; font-size:14px;"></textarea>
            </div>
            <button type="submit" class="btn-godaddy-dark" style="padding:12px; font-size:14px; margin-top:8px;">Send Message</button>
            <div id="contact-success-msg" style="display:none; color:#15803d; font-size:14px; font-weight:600;">Thank you! Your message has been received.</div>
          </form>
        </div>
      </div>
    </div>
  `;
}

// Helper to assemble full HTML page from template
function generatePage({ pagePath, title, description, canonical, activeNavKey, contentHtml }) {
  let html = master;

  // Replace Title
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

  // Replace Meta Description
  html = html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${description}"`);

  // Replace Canonical Link
  html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonical}"`);

  // Replace OpenGraph Title & Description & URL
  html = html.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${title}"`);
  html = html.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${description}"`);
  html = html.replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${canonical}"`);

  // Replace Twitter Title & Description & URL
  html = html.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${title}"`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${description}"`);
  html = html.replace(/<meta name="twitter:url" content="[^"]*"/, `<meta name="twitter:url" content="${canonical}"`);

  // Update Active Navigation Item in Header
  html = html.replace(/class="nav-item active" data-nav="home"/, `class="nav-item" data-nav="home"`);
  html = html.replace(new RegExp(`class="nav-item" data-nav="${activeNavKey}"`), `class="nav-item active" data-nav="${activeNavKey}"`);

  // Replace Main Container Body Content
  const appContainerRegex = /<main id="app-view-container">[\s\S]*?<\/main>/;
  html = html.replace(appContainerRegex, `<main id="app-view-container">\n${contentHtml}\n  </main>`);

  // Ensure output directory exists and write file
  const fullDir = path.dirname(pagePath);
  if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
  fs.writeFileSync(pagePath, html, 'utf8');
  console.log('Generated:', pagePath);
}

// 1. Generate /order/index.html
generatePage({
  pagePath: 'order/index.html',
  title: 'Artisan Menu & Online QR Ordering — Coffee & Cravings Patna',
  description: 'Explore 80+ handcrafted dishes at Coffee & Cravings Patna. Order specialty coffee, Penne Alfredo, gourmet burgers & waffles with instant QR ordering.',
  canonical: 'https://www.coffeeandcravings.shop/order',
  activeNavKey: 'order',
  contentHtml: buildOrderContent()
});

// 2. Generate /story/index.html
generatePage({
  pagePath: 'story/index.html',
  title: 'Our Story & Passion for Coffee — Coffee & Cravings Patna',
  description: 'Discover the story of Coffee & Cravings in Mithapur, Patna. Dedicated to roasting 100% Arabica beans and serving authentic Italian recipes in a cozy space.',
  canonical: 'https://www.coffeeandcravings.shop/story',
  activeNavKey: 'story',
  contentHtml: buildStoryContent()
});

// 3. Generate /gallery/index.html
generatePage({
  pagePath: 'gallery/index.html',
  title: 'Photo Gallery & Aesthetic Ambience — Coffee & Cravings Patna',
  description: 'View photos of our cozy cafe interior, couple seating, latte art, Belgian waffles & Italian pasta at Coffee & Cravings in Mithapur Farm Area, Patna.',
  canonical: 'https://www.coffeeandcravings.shop/gallery',
  activeNavKey: 'gallery',
  contentHtml: buildGalleryContent()
});

// 4. Generate /contact/index.html
generatePage({
  pagePath: 'contact/index.html',
  title: 'Contact, Location & Opening Hours — Coffee & Cravings Patna',
  description: 'Visit Coffee & Cravings in Mithapur Farm Area, Patna. Open daily 10:30 AM – 10:00 PM. Call 620-567-7925 for table bookings, inquiries, and directions.',
  canonical: 'https://www.coffeeandcravings.shop/contact',
  activeNavKey: 'contact',
  contentHtml: buildContactContent()
});

console.log('All static subpages successfully generated!');

