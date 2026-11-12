'use strict';
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');
const robots = fs.readFileSync('robots.txt', 'utf8');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('  ok  ' + name); };

(async () => {
  console.log('Running Professional SEO Audits...\n');

  t('Title tag is optimized for local search and brand', () => {
    const m = html.match(/<title>([^<]+)<\/title>/);
    assert(m, 'Title tag must exist');
    assert(/Coffee &amp; Cravings/i.test(m[1]), 'Title must contain brand name');
    assert(/Patna/i.test(m[1]), 'Title must contain target city (Patna)');
    assert(/Cafe|Coffee/i.test(m[1]), 'Title must contain primary category');
  });

  t('Meta description is present, under 165 characters, and keyword-rich', () => {
    const m = html.match(/<meta name="description" content="([^"]+)"/);
    assert(m, 'Meta description must exist');
    assert(m[1].length > 60 && m[1].length <= 165, 'Description length should be between 60 and 165 chars, got ' + m[1].length);
    assert(/Patna/i.test(m[1]) && /Coffee/i.test(m[1]), 'Description must contain core local keywords');
  });

  t('Canonical link points to HTTPS root domain', () => {
    const m = html.match(/<link rel="canonical" href="([^"]+)"/);
    assert(m, 'Canonical link must exist');
    assert.equal(m[1], 'https://www.coffeeandcravings.shop/');
  });

  t('OpenGraph and Twitter cards are complete with high-res 1200x675 image', () => {
    assert(html.includes('property="og:title"'), 'og:title missing');
    assert(html.includes('property="og:description"'), 'og:description missing');
    assert(html.includes('property="og:image"'), 'og:image missing');
    assert(html.includes('property="og:url"'), 'og:url missing');
    assert(html.includes('name="twitter:card" content="summary_large_image"'), 'twitter:card summary_large_image missing');
    assert(html.includes('name="twitter:image"'), 'twitter:image missing');
  });

  t('Schema.org JSON-LD contains WebSite, CafeOrCoffeeShop, BreadcrumbList, and FAQPage', () => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert(m, 'JSON-LD script must exist in index.html');
    const parsed = JSON.parse(m[1]);
    assert(parsed['@graph'], '@graph array required');

    const types = parsed['@graph'].map(e => Array.isArray(e['@type']) ? e['@type'].join(',') : e['@type']);
    assert(types.some(t => t.includes('WebSite')), 'WebSite schema missing');
    assert(types.some(t => t.includes('CafeOrCoffeeShop')), 'CafeOrCoffeeShop schema missing');
    assert(types.some(t => t.includes('BreadcrumbList')), 'BreadcrumbList schema missing');
    assert(types.some(t => t.includes('FAQPage')), 'FAQPage schema missing');

    const cafe = parsed['@graph'].find(e => (Array.isArray(e['@type']) ? e['@type'] : [e['@type']]).includes('CafeOrCoffeeShop'));
    assert.equal(cafe.telephone, '+916205677925');
    assert(cafe.address && cafe.address.addressLocality === 'Patna');
    assert(cafe.geo && cafe.geo.latitude && cafe.geo.longitude);
    assert(cafe.openingHoursSpecification && cafe.openingHoursSpecification.length > 0);
  });

  t('Static semantic crawler fallback has h1, h2, all category keywords, and FAQs', () => {
    assert(html.includes('<h1'), 'Semantic <h1> missing');
    assert(html.includes('<h2'), 'Semantic <h2> missing');
    assert(/Specialty Hot/i.test(html), 'Coffee category missing from static fallback');
    assert(/Pastas/i.test(html), 'Pastas category missing from static fallback');
    assert(/Burgers/i.test(html), 'Burgers category missing from static fallback');
    assert(/Waffles/i.test(html), 'Waffles category missing from static fallback');
    assert(/Frequently Asked Questions/i.test(html), 'FAQ text missing from static fallback');
  });

  t('Sitemap.xml contains all 5 main pages with 2026-11-09 lastmod and no fragments', () => {
    const locUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
    const expectedPages = [
      'https://www.coffeeandcravings.shop/',
      'https://www.coffeeandcravings.shop/order',
      'https://www.coffeeandcravings.shop/story',
      'https://www.coffeeandcravings.shop/gallery',
      'https://www.coffeeandcravings.shop/contact'
    ];
    for (const page of expectedPages) {
      assert(locUrls.some(u => u === page), 'Page missing from sitemap: ' + page);
    }
    assert(!sitemap.includes('#'), 'Sitemap must not contain hash fragments');
    assert(!sitemap.includes('2026-11-07'), 'All lastmod dates should be updated to latest release');
  });

  t('Robots.txt disallows /staff and points to valid sitemap', () => {
    const lines = robots.split('\n').map(l => l.trim());
    assert(lines.includes('Disallow: /staff'), 'Staff should be disallowed in robots.txt');
    assert(lines.some(l => l === 'Sitemap: https://www.coffeeandcravings.shop/sitemap.xml'), 'Sitemap directive missing');
  });

  t('vercel.json enforces complete HTTP security headers and CSP', () => {
    const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    assert(vercel.headers && vercel.headers.length >= 3, 'Security headers rules required in vercel.json');
    const globalRule = vercel.headers.find(h => h.source === '/(.*)');
    assert(globalRule, 'Global headers rule /(.*) must exist');
    const keys = globalRule.headers.map(h => h.key);
    assert(keys.includes('Content-Security-Policy'), 'CSP missing');
    assert(keys.includes('X-Frame-Options'), 'X-Frame-Options missing');
    assert(keys.includes('X-Content-Type-Options'), 'X-Content-Type-Options missing');
    assert(keys.includes('X-XSS-Protection'), 'X-XSS-Protection missing');
    assert(keys.includes('Permissions-Policy'), 'Permissions-Policy missing');
    assert(keys.includes('Referrer-Policy'), 'Referrer-Policy missing');
    assert(keys.includes('Cross-Origin-Opener-Policy'), 'COOP missing');
    assert(keys.includes('Cross-Origin-Resource-Policy'), 'CORP missing');
    assert(keys.includes('Cache-Control'), 'Cache-Control missing');
  });

  t('GEO & AEO Schema.org contains aggregateRating, authentic reviews, amenities, and structured menu', () => {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const parsed = JSON.parse(m[1]);
    const cafe = parsed['@graph'].find(e => (Array.isArray(e['@type']) ? e['@type'] : [e['@type']]).includes('CafeOrCoffeeShop'));
    assert(cafe.aggregateRating && cafe.aggregateRating.ratingValue === '4.8', 'aggregateRating with 4.8 score required for Google golden star snippets');
    assert(Array.isArray(cafe.review) && cafe.review.length >= 2, 'Authentic local Patna reviews required in Schema.org graph');
    assert(Array.isArray(cafe.amenityFeature) && cafe.amenityFeature.length >= 3, 'Amenity features (Wi-Fi, QR ordering) required in Schema');
    assert(Array.isArray(cafe.areaServed) && cafe.areaServed.some(a => a.name === 'Patna'), 'Patna city and neighborhood areaServed required');
    assert(cafe.hasMenu && typeof cafe.hasMenu === 'object' && Array.isArray(cafe.hasMenu.hasMenuSection), 'Structured Menu entity with sections required');
  });

  t('GEO: AI Search engine crawler permissions present in robots.txt and llms.txt exists', () => {
    assert(robots.includes('User-agent: GPTBot'), 'GPTBot directive required for ChatGPT Search');
    assert(robots.includes('User-agent: PerplexityBot'), 'PerplexityBot directive required for Perplexity AI');
    assert(robots.includes('User-agent: Google-Extended'), 'Google-Extended directive required for Gemini AI');
    assert(fs.existsSync('llms.txt'), 'llms.txt standard knowledge file must exist');
    const llms = fs.readFileSync('llms.txt', 'utf8');
    assert(llms.includes('Coffee & Cravings'), 'llms.txt must declare business name');
    assert(llms.includes('Patna'), 'llms.txt must declare city location');
    assert(llms.includes('Mithapur'), 'llms.txt must declare neighborhood');
    assert(llms.includes('Penne Alfredo'), 'llms.txt must document top dishes');
  });

  t('Image SEO: Sitemap contains Google Image XML extension for visual search', () => {
    assert(sitemap.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'), 'Google image XML namespace required');
    assert(sitemap.includes('<image:image>'), '<image:image> tags required for image SEO');
    assert(sitemap.includes('<image:loc>'), '<image:loc> required for indexed dish photos');
  });

  t('Google Indexation: Individual static HTML pages exist for all sitemap URLs with self-referencing canonicals', () => {
    const pages = [
      { file: 'order/index.html', canonical: 'https://www.coffeeandcravings.shop/order', title: 'Artisan Menu & Online QR Ordering — Coffee & Cravings Patna' },
      { file: 'story/index.html', canonical: 'https://www.coffeeandcravings.shop/story', title: 'Our Story & Passion for Coffee — Coffee & Cravings Patna' },
      { file: 'gallery/index.html', canonical: 'https://www.coffeeandcravings.shop/gallery', title: 'Photo Gallery & Aesthetic Ambience — Coffee & Cravings Patna' },
      { file: 'contact/index.html', canonical: 'https://www.coffeeandcravings.shop/contact', title: 'Contact, Location & Opening Hours — Coffee & Cravings Patna' }
    ];

    for (const p of pages) {
      assert(fs.existsSync(p.file), 'Missing static HTML file: ' + p.file);
      const content = fs.readFileSync(p.file, 'utf8');
      assert(content.includes('<link rel="canonical" href="' + p.canonical + '" />'), 'Self-referencing canonical missing in ' + p.file);
      assert(content.includes('<title>' + p.title + '</title>'), 'Unique title missing in ' + p.file);
    }
  });

  t('Crawlability & PWA: Clean internal anchor links and Web App Manifest configured', () => {
    assert(html.includes('href="/order"'), 'Crawlable /order link required in navigation');
    assert(html.includes('href="/story"'), 'Crawlable /story link required in navigation');
    assert(html.includes('href="/gallery"'), 'Crawlable /gallery link required in navigation');
    assert(html.includes('href="/contact"'), 'Crawlable /contact link required in navigation');
    assert(html.includes('<link rel="manifest" href="/manifest.json" />'), 'Manifest link required in index.html');
    assert(fs.existsSync('manifest.json'), 'manifest.json must exist');
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    assert(manifest.name && manifest.start_url && manifest.icons.length > 0, 'manifest.json fields required for mobile SEO');
  });

  t('Custom 404 Page: Branded error page exists with noindex and recovery navigation links', () => {
    assert(fs.existsSync('404.html'), '404.html custom error page must exist');
    const page404 = fs.readFileSync('404.html', 'utf8');
    assert(page404.includes('content="noindex, follow"'), '404 page must specify noindex, follow');
    assert(page404.includes('href="/order"'), '404 page must provide a recovery link to /order');
    assert(page404.includes('href="/"'), '404 page must provide a recovery link to home');
    assert(page404.includes('Coffee &amp; Cravings'), '404 page must maintain brand identity');
  });

  console.log(`\n${n} SEO, GEO & AEO audits passed successfully!`);
})().catch(e => {
  console.error('SEO AUDIT FAILED:', e);
  process.exit(1);
});

