# Coffee & Cravings

Artisan cafe & kitchen ordering website with QR table ordering, online Razorpay & UPI payments, owner portal, staff kitchen display, CRM deals, customer authentication, and inquiries inbox.

## Customer Experience (`/`)
- **Artisan Menu:** 80 curated items across 14 categories with dietary filters, instant search, and live BOGO deal badges.
- **Smart Add-Ons:** Contextual culinary add-on recommendations in the cart drawer (e.g. Vanilla Ice Cream for Brownies, Peri Peri Dip for Fries).
- **Table Ordering:** Limited to 6 cozy tables. QR codes carry cryptographic HMAC signatures (`sig`) ensuring orders match seated tables.
- **Seamless Authentication:** 1-Click Google Sign-In (via Google Identity Services) or 6-digit email OTP.
- **Cart & Payments:** Real-time calculation, server-validated coupon discounts, and choice between instant UPI QR or Pay-at-Counter (Cash).
- **Contact & Inquiries:** Integrated customer message form that stores feedback in Redis for direct owner review.
- **Privacy & Statutory Compliance:** Fully compliant with India's Digital Personal Data Protection Act, 2023 (DPDP Act) with non-intrusive legal notice, full statutory Privacy Policy, and 1-tap customer account erasure ("Right to be Forgotten").

## Payments & Security
- **Dual-Mode Payments:** Razorpay Checkout & dynamic UPI QR codes, alongside Pay-at-Counter cash settlement.
- **Webhook Safety Net:** `/api/payments/webhook` with HMAC-SHA256 signature verification and replay prevention.
- **Enterprise Security Hardening:**
  - IDOR prevention on order histories and customer profiles.
  - Multi-layer rate limiting (per-IP and per-email) across checkout, login OTPs, contact submissions, and coupon queries.
  - Production fail-safes disabling static fallback secrets and default PINs.
  - Hashed OTP storage (SHA-256) with 5-minute auto-expiry.
  - HttpOnly, SameSite strict session cookies.

## Owner & Staff Portal (`/staff`)
- **Orders (Live Kitchen Display):** Barista KDS with instant sound chimes, status progression (Incoming &rarr; Preparing &rarr; Ready to Serve &rarr; Completed), and payment tracking.
- **Reports:** Today / 7-day / 30-day analytics. Revenue, paid orders, average order, discounts given, GST collected, hourly heatmaps, top sellers, and CSV export.
- **Menu Management:** Add, edit, price, hide, or delete products and categories in real time.
- **Deals (BOGO / Buy X Get Y):** Automated server-discounted promotions with real-time UI alerts.
- **Coupons:** Flat or percentage discounts, minimum order values, caps, expiry dates, and usage limits.
- **Customer CRM:** Customer visit tracking, order counts, and lifetime spend records.
- **Inquiries Inbox:** Direct customer feedback and questions with one-click `mailto:` email replies and message deletion.
- **QR Placards:** High-resolution printable QR code generator with cryptographic table signatures.
- **PINs & Security:** Self-service rotation of Owner and Barista access PINs with real-time session invalidation.

## Technical Architecture & Redis Usage
- **Zero External Dependencies:** Built entirely with native Node.js core libraries (`http`, `crypto`, `https`) for ultra-low latency and minimal attack surface.
- **Upstash Redis REST KV:** Efficient serverless key-value and sorted set storage.
- **KDS Order Retention:** Active kitchen queue retention set to 24 hours (`ORDER_TTL_S = 86400`), while customer lifetime receipts are archived permanently under `cust:orders:<user>`.
- **Automated Test Coverage:** 71 automated integration checks verifying API security, payments, CRM rules, staff auth, and customer flows (`npm test`).
