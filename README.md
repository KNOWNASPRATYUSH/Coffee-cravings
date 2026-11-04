# Coffee & Cravings

Artisan cafe & kitchen ordering website with QR table ordering, online Razorpay & UPI payments, owner portal, staff kitchen display, CRM deals, and customer authentication.

## Customer site (`/`)
- Artisan menu with categories, dietary filters, search, and live BOGO deal tags.
- Table ordering: QR code signs the table number (`sig`), so customers at Table 03 cannot order for Table 07.
- Mandatory sign-in before checkout: Customers sign in via Google or Gmail 6-digit OTP to place an order, view order history, and unlock loyalty deals.
- Cart drawer with dynamic checkout, live coupon verification, and UPI / Cash-at-counter options.

## Payments
- Razorpay Checkout & dynamic UPI QR codes.
- Webhook safety net (`/api/payments/webhook`) and signature verification.

## Owner portal (`/staff`, owner PIN)
- **Reports:** today / 7 / 30 days. Revenue, paid orders, average order, discounts, GST, busy hours, top items, payment split, CSV download.
- **Menu:** add / edit / hide / delete products and categories.
- **Deals (BOGO / Buy X Get Y):** Create promotional deals with live tags and automatic server discounting.
- **Coupons:** percent or flat, minimum order, max discount, expiry date, usage limit.
- **Customer CRM:** Tracks customer visits, paid orders, and lifetime spend.

## Customer Accounts & Lifetime Order History (100% Free Forever)
- **Sign In with Google (1-Click):** Powered by Google Identity Services (`gsi/client`) for instant 1-tap sign-in without passwords.
- **Gmail 6-Digit OTP:** Secure email verification code generated cryptographically and stored in Redis with 5-minute expiry. Works with Gmail SMTP or Resend (3,000 free emails/mo).
- **Lifetime Receipts:** All items, prices, discounts, tables, and receipts are saved permanently in Redis (`cust:orders:<user>`) and never disappear.
- **My Orders:** Live status updates for active kitchen orders (polling every 8s) + full archive of past orders with 1-tap "Re-order" to cart.

## Redis usage
Barista screens ask "anything new?" every 8 s (1 Redis command) and download orders only when something changed.
Sales totals are kept as small daily counters, so reports stay fast and orders can expire after 48 h.
