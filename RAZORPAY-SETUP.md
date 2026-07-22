# Getting Razorpay (UPI / Netbanking) live on your site

Your site now has a real "Pay Online" option at checkout. To turn it on,
you need a Razorpay account and to deploy the site on Vercel (free).
Takes about 15 minutes.

## 1. Create your Razorpay account

1. Go to https://razorpay.com and sign up as a business.
2. You'll start in **Test Mode** — good for trying everything out with
   fake payments before going live.
3. In the Razorpay Dashboard, go to **Settings → API Keys** and click
   **Generate Test Key**. You'll get:
   - a **Key ID** (starts with `rzp_test_...`)
   - a **Key Secret** (only shown once — copy it somewhere safe)
4. Later, once you've completed KYC (business documents), you can
   generate **Live Keys** the same way — they start with `rzp_live_...`.

## 2. Deploy the site to Vercel

1. Go to https://vercel.com and sign up (free, can use GitHub or email).
2. Put this whole `sl` folder into a GitHub repository (or use
   Vercel's drag-and-drop "Deploy" option for a quick first try).
3. In Vercel, click **Add New Project** and import that repo/folder.
4. Vercel will detect the `api/` folder automatically — no config needed.

## 3. Add your Razorpay keys to Vercel

1. In your Vercel project, go to **Settings → Environment Variables**.
2. Add two variables:
   - `RAZORPAY_KEY_ID` → your Key ID
   - `RAZORPAY_KEY_SECRET` → your Key Secret
3. Redeploy the project (Vercel does this automatically after you save
   environment variables, or click **Redeploy**).

## 4. Connect your domain

1. Buy your domain from any registrar (GoDaddy, Namecheap, Hostinger —
   doesn't matter which).
2. In Vercel, go to **Settings → Domains**, add your domain, and follow
   the DNS instructions Vercel shows you (usually just adding one or
   two records at your registrar).

## 5. Test it

1. Visit your live site, add something to the cart, and checkout with
   **"Pay Online Now (UPI / Netbanking)"**.
2. In Test Mode, Razorpay lets you simulate a UPI/netbanking payment
   without real money — see https://razorpay.com/docs/payments/payments/test-card-upi-details/
3. Once you're happy, swap your `RAZORPAY_KEY_ID` /
   `RAZORPAY_KEY_SECRET` in Vercel for your **Live** keys, and you're
   accepting real payments.

## How it works (for reference)

- The customer fills their details in the cart drawer, then moves to
  the review step where payment is **always online** — there is no
  Cash on Delivery or manual bank transfer option anymore.
- The browser asks `/api/create-order` (a small serverless function)
  to create a Razorpay order. This is where your **Key Secret** is
  used — it never reaches the browser.
- Razorpay's checkout widget opens with **UPI, Netbanking, Debit
  Card and Credit Card** all available. The UPI screen shows every
  UPI app installed on the customer's phone (GPay, PhonePe, Paytm,
  etc.) automatically — that's built into Razorpay's checkout, no
  extra setup needed.
- The browser sends the payment result to `/api/verify-payment`,
  which checks Razorpay's cryptographic signature to make sure the
  payment is real and wasn't tampered with.
- Once verified, two things happen automatically:
  1. The order — including any customer-uploaded customization
     photos and notes — is logged to your Google Sheet (see
     `GOOGLE-SHEETS-SETUP.md`).
  2. A Shipmozo forward shipment is created for the order (see
     `SHIPMOZO-SETUP.md`).
