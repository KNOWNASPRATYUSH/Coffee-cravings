# Coffee & Cravings

- `/`  customer site (menu, cart, table QR ordering). No staff links or staff code.
- `/staff`  barista + owner portal. Not linked anywhere, `noindex`, PIN login checked on the server.
- `/api`  order + staff API (Vercel Functions). Orders live in Upstash Redis, auto-expire after 48h.

## Deploy
1. Push to GitHub (Vercel auto-deploys).
2. Vercel -> Storage/Marketplace -> add **Upstash Redis** and connect it to this project.
3. Set `SESSION_SECRET`, `OWNER_PIN`, `BARISTA_PIN` (see `.env.example`), then redeploy.
4. Open `/staff`, sign in with the OWNER PIN, go to **QR Codes**, print one signed QR per table.
   Old unsigned QR codes stop working for table orders on purpose.

## Staff access
Give baristas only the `/staff` link and the BARISTA PIN. Lost phone / ex-employee: change `BARISTA_PIN`
and redeploy — every existing barista session is signed out immediately. Rotating `SESSION_SECRET` signs out everyone.

## Tests
`npm test` runs the API checks (auth, lockout, signed tables, price tampering, idempotency, roles).

## Online payments (Razorpay) — when you are ready
1. Razorpay Dashboard -> API Keys: put `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in Vercel.
2. Dashboard -> Webhooks -> add `https://YOUR-DOMAIN/api/payments/webhook`, events `payment.captured` and `order.paid`,
   choose a secret and put it in `RAZORPAY_WEBHOOK_SECRET`. Keep payment capture on **automatic**.
3. Redeploy. Test in Razorpay **test mode** first. Until all three variables exist nothing changes.

Flow: UPI/card order is created as `awaiting_payment` (barista cannot see it) -> gateway confirms (browser callback is
verified by signature, webhook is the safety net) -> order becomes **PAID** and appears on the barista screen.
"Pay at Counter" orders go straight to the barista as UNPAID.
