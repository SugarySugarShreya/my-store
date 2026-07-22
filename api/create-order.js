/* ======================================================
    CREATE RAZORPAY ORDER
    Runs on the server (Vercel serverless function).
    The Razorpay Key Secret NEVER reaches the browser —
    it only lives here, as an environment variable.

    Set these in your Vercel project settings:
      RAZORPAY_KEY_ID
      RAZORPAY_KEY_SECRET
====================================================== */

const Razorpay = require("razorpay");

module.exports = async (req, res) => {

    // Allow the browser to call this endpoint
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { amount, cart } = req.body;

        if (!amount || typeof amount !== "number" || amount <= 0) {
            return res.status(400).json({ error: "Invalid order amount" });
        }

        // Basic sanity check: recompute total from the cart the browser
        // sent, so a tampered "amount" field can't be used to underpay.
        if (Array.isArray(cart)) {
            const recomputed = cart.reduce(
                (sum, item) => sum + (Number(item.price) * Number(item.qty)),
                0
            );
            if (recomputed !== amount) {
                return res.status(400).json({ error: "Amount does not match cart" });
            }
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100), // Razorpay wants paise
            currency: "INR",
            receipt: `sl_${Date.now()}`,
        });

        return res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });

    } catch (err) {
        console.error("create-order error:", err);
        return res.status(500).json({ error: "Could not create Razorpay order" });
    }
};
