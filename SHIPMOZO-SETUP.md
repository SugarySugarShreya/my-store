# Getting Shipmozo shipping live on your site

Your site now automatically creates a Shipmozo shipping order (and gets
an AWB assigned) the moment a customer's payment is verified — no
manual "add order in Shipmozo panel" step. Takes about 10 minutes to
switch on.

## 1. Get your Shipmozo API keys

1. Log in to your Shipmozo panel at https://app.shipmozo.com.
2. Go to **Settings → API** (sometimes shown as **API Keys** or
   **Developer Settings**).
3. Generate a **Public Key** and **Private Key** if you don't already
   have them. Copy both somewhere safe — the private key is only
   shown once.
4. On the same page, Shipmozo shows the live request/response
   reference for your account. Keep this page open — see the note at
   the bottom of this file about why it matters.

## 2. Find your Warehouse (pickup address) ID

1. In the Shipmozo panel, go to **Settings → Pickup Address**.
2. Make sure your pickup address (where couriers collect parcels
   from) is added and verified.
3. Note the **Warehouse ID** / **Pickup ID** shown for that address —
   you'll need it below.

## 3. Add your keys to Vercel

1. In your Vercel project, go to **Settings → Environment Variables**.
2. Add:
   - `SHIPMOZO_PUBLIC_KEY` → your Public Key
   - `SHIPMOZO_PRIVATE_KEY` → your Private Key
   - `SHIPMOZO_WAREHOUSE_ID` → your Warehouse/Pickup ID
3. Redeploy the project (Vercel does this automatically after saving
   environment variables, or click **Redeploy**).

That's it — shipping orders will now be created automatically. Until
these three variables are set, the site simply skips shipment
creation (checkout still works, nothing breaks).

## 4. What happens automatically

- **On checkout**: the customer enters City, State and Pincode in
  addition to their address. As soon as they type a 6-digit pincode,
  the site quietly checks serviceability with Shipmozo and shows a
  small note if that pincode currently isn't deliverable — this never
  blocks checkout, it's just a heads up.
- **After payment is verified**: `/api/create-shipment` pushes a
  forward (prepaid) order to Shipmozo with the customer's address and
  cart contents, and gets back an AWB/tracking number.
- **Order status**: `/api/order-status?orderId=...` or
  `?awb=...` looks up the live shipment status any time you need it
  (e.g. to build a "track my order" page later, or check from a
  script/Postman).

## 5. A note on exact field names

Shipmozo doesn't publish one fixed public API reference — the exact
request/response field names for your account are shown inside your
own panel once you generate API keys (the page from Step 1). This
integration follows Shipmozo's standard "push order / track order /
check pincode" pattern.

Everything Shipmozo-specific lives in a single file:
**`lib/shipmozo.js`**. If your panel's reference shows different field
names than what's used here, that's the only file you need to edit —
every API route in this project (`create-shipment.js`,
`order-status.js`, `check-pincode.js`) calls the functions exported
from `lib/shipmozo.js` and never talks to Shipmozo's HTTP API
directly.

To confirm everything is wired correctly, place one real test order
through checkout and check:
1. The Vercel function logs for `create-shipment` (**Vercel dashboard
   → your project → Logs**) — if Shipmozo rejected the payload, the
   exact error message from Shipmozo is logged there.
2. Your Shipmozo panel — the order should appear under **Orders**
   with an AWB assigned.

If step 1 shows a field-name mismatch, adjust the payload inside
`createForwardOrder()` in `lib/shipmozo.js` to match your panel's
reference, then redeploy.
