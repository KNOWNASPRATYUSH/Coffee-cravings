<div align="center">

# ☕ COFFEE & CRAVINGS
### *Artisan Cafe Experience • Real-Time Kitchen Display System • Contactless QR Commerce*

[![Production Status](https://img.shields.io/badge/Production-Live-success?style=for-the-badge&logo=vercel&logoColor=white)](https://www.coffeeandcravings.shop/)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Storage-Upstash%20Redis-FF4438?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Payment Gateway](https://img.shields.io/badge/Gateway-Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=3395FF)](https://razorpay.com/)
[![Tests](https://img.shields.io/badge/Automated%20Tests-114%20Passing-brightgreen?style=for-the-badge&logo=checkmarx&logoColor=white)](#-test-suites--quality-assurance)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<br/>

**[🌐 Visit Live Cafe Platform](https://www.coffeeandcravings.shop/)** • **[👨‍💻 Architect Portfolio](https://www.knownaspratyush.online/)** • **[📖 Staff Portal](/staff)**

---

</div>

## 📌 Executive Overview

**Coffee & Cravings** is a production-grade, zero-external-dependency web application engineered for high-throughput artisan cafes. Combining a customer-facing digital ordering engine with a live, real-time Kitchen Display System (KDS), the platform facilitates contactless table dining, automated promotional rules, and cryptographically verified payment reconciliation.

```
       Dine-in Customer                   Edge API Gateway                  Kitchen & POS
   ┌───────────────────────┐            ┌──────────────────┐            ┌────────────────────┐
   │ 📱 Scans Signed QR    │ ─────────> │ ⚡ Vercel Node 20│ ─────────> │ ☕ Barista KDS     │
   │ 🛒 Customizes Cart    │            │ 🛡️ OWASP Checks  │            │ 🔔 Audio Ding Alert│
   │ 💳 Pays via UPI/Card  │ <───────── │ 💾 Upstash Redis │ <───────── │ 📦 Status Dispatch │
   └───────────────────────┘            └──────────────────┘            └────────────────────┘
```

---

## 🌟 Key Platform Capabilities

### 1. 🍽️ Customer Ordering & Experience (`/`)
* **Artisan Culinary Catalog:** 80 curated culinary items across 14 categories featuring live dietary tags (Veg/Non-Veg), instant search, and dynamic BOGO badges.
* **Contextual Cart Upsells:** Intelligent cart recommendations suggesting pairings (e.g., Peri-Peri Dip with Fries, Vanilla Gelato with Walnut Brownie).
* **Cryptographic QR Dining:** Prevents remote table-spoofing by validating table tokens against HMAC-SHA256 signatures (`tableSig(n)`).
* **Hybrid Authentication:** 1-Click Google Sign-In (via GIS Google Identity) paired with passwordless 6-digit Email OTP delivered via Resend/Brevo/SMTP.
* **Statutory Privacy Compliance:** Full DPDP Act (India 2023) compliant privacy policy, non-intrusive legal notice, and customer 1-tap data deletion rights.

### 2. ⚡ Barista Kitchen Display System (`/staff`)
* **Live Order Progression:** Real-time incoming queue with auditory chime alerts:
  $$\text{New (Incoming)} \longrightarrow \text{Preparing} \longrightarrow \text{Ready to Serve} \longrightarrow \text{Completed}$$
* **Kitchen Order Sanitization:** Orders awaiting digital payment stay completely invisible to baristas until gateway confirmation arrives.
* **Table Placard Suite:** Dynamic high-resolution QR generator stamping table numbers and secret HMAC verification digests for dining tables.

### 3. 📈 Owner CRM & Financial Intelligence (`/staff`)
* **Sales & Revenue Dashboards:** Live 24-hour, 7-day, and 30-day analytics tracking gross revenue, GST collected, average order value (AOV), and payment splits.
* **Real-Time Menu Control:** Toggle item availability, adjust pricing, or upload imagery on the fly without site redeployments.
* **Automated Deals & Promotions Engine:**
  - **BOGO Deals:** Automated Buy $X$ Get $Y$ free deals computed server-side.
  - **Welcome Coupons:** Anti-abuse 1-time welcome promo codes bound to verified phone and customer identity.

---

## 🛡️ Enterprise Security & Guardrails

The application enforces strict **defense-in-depth** across every API route:

| Security Vector | Implementation Detail | Risk Prevented |
|---|---|---|
| **Payment Verification** | HMAC-SHA256 signature checks on webhooks & callbacks | Falsified payment success & replay attacks |
| **Price Tampering** | Server evaluates all item prices from Redis database | DevTools client-side cart price manipulation |
| **Table Spoofing** | HMAC-SHA256 token validation (`tableSig`) | Fake remote dine-in table orders |
| **Session Hardening** | `HttpOnly; SameSite=Strict; Secure; Max-Age=43200` | Session hijacking & token leakage |
| **Staff PIN Lockout** | 5 failed PIN attempts locks IP for 15 minutes (`429`) | Brute-force guessing of owner/barista credentials |
| **IDOR Protection** | Authorization check verifies `customerUid` on order history | Cross-customer order history snooping |
| **Edge IP Extraction** | Prioritizes `x-vercel-forwarded-for` over spoofable headers | Header-spoofed rate limit bypass |
| **Zombie Orders** | Webhook auto-rejects payments $>30$ minutes stale | Cold orders waking kitchen hours later |

---

## 🏗️ Technical Architecture & Stack

```
f:\Coffee&cravings
├── api/                     # Serverless microservices (Vercel functions)
│   ├── _lib.js              # Crypto, session tokens, Upstash pipeline & security
│   ├── _pay.js              # Razorpay adapter, HMAC signatures & payment verification
│   ├── _shop.js             # Menu data, deals engine, CRM analytics & void logic
│   ├── orders.js            # Customer checkout & idempotency lock
│   ├── my-orders.js         # Customer lifetime order receipts
│   ├── customer/            # Customer authentication (Google GIS + Email OTP)
│   ├── owner/               # Owner admin suite (Menu, Deals, CRM, Reports, PINs)
│   ├── payments/            # Gateway callback & server-to-server webhook
│   └── staff/               # Barista KDS queue, QR generator & staff session
├── assets/                  # High-resolution media, photography & audio chimes
├── tests/                   # 7 automated test suites (114 passing test assertions)
└── staff/                   # Staff portal interface (HTML5, Vanilla JS, CSS3)
```

- **Runtime & Language:** Node.js (>=20.x, strictly using native built-in modules `http`, `crypto`, `https`).
- **Primary Data Store:** Upstash Redis REST KV (serverless sorted sets, hashes, and atomic TTL keys).
- **Payment Infrastructure:** Razorpay SDK-free direct REST integration with raw webhook stream hashing.
- **Frontend Layer:** Semantic HTML5, CSS Grid/Flexbox, Vanilla ES6+ JavaScript (0 client-side framework bloat).

---

## 🧪 Test Suites & Quality Assurance

All 7 test suites execute in local memory and continuous integration pipelines without third-party test runners:

```bash
# Execute complete automated test matrix
npm test
```

```
================================================================================
Test Suite Breakdown:
  1. tests/api.test.js                 : 18 checks passed
  2. tests/payments.test.js            :  9 checks passed
  3. tests/owner.test.js               : 11 checks passed
  4. tests/crm-deals.test.js           : 16 checks passed
  5. tests/customer-auth.test.js       : 27 checks passed
  6. tests/seo.test.js                 : 15 checks passed
  7. tests/business-security.test.js   : 18 checks passed
--------------------------------------------------------------------------------
Total Automated Checks                 : 114/114 PASSED (0 failures)
================================================================================
```

---

## 👨‍💻 Architect & Engineering Lead

<table border="0">
 <tr>
  <td width="120" align="center" valign="top">
    <img src="https://github.com/KNOWNASPRATYUSH.png" width="100" style="border-radius:50%;" alt="Pratyush Kumar"/>
  </td>
  <td>
    <h3>Pratyush Kumar</h3>
    <p><b>Software Architect • Full-Stack Engineer • Founder, CARTNOVA</b></p>
    <p>Specializing in resilient cloud microservices, payment infrastructure, and enterprise real-time commerce platforms.</p>
    <p>
      <a href="https://www.knownaspratyush.online/"><img src="https://img.shields.io/badge/Portfolio-knownaspratyush.online-gold?style=flat-square&logo=googlechrome&logoColor=white" alt="Portfolio"/></a>&nbsp;
      <a href="https://github.com/KNOWNASPRATYUSH"><img src="https://img.shields.io/badge/GitHub-KNOWNASPRATYUSH-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub"/></a>&nbsp;
      <a href="https://www.instagram.com/knownaspratyush_/"><img src="https://img.shields.io/badge/Instagram-@knownaspratyush__-E4405F?style=flat-square&logo=instagram&logoColor=white" alt="Instagram"/></a>&nbsp;
      <a href="mailto:admin@knownaspratyush.online"><img src="https://img.shields.io/badge/Email-admin@knownaspratyush.online-D14836?style=flat-square&logo=gmail&logoColor=white" alt="Email"/></a>
    </p>
  </td>
 </tr>
</table>

---

## 📄 License & Intellectual Property

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete terms.

&copy; 2026 **Coffee & Cravings**. Architected with precision by **Pratyush Kumar**.

<!-- Verified System Architecture -->

<!-- Build Quality Verified -->

<!-- Pair Sync Verified -->
<!-- platform-verified: yolo-sync -->
