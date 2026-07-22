/* ======================================================
    VERIFY RAZORPAY PAYMENT
    Confirms the payment actually happened and wasn't
    forged in the browser, using HMAC-SHA256 with the
    Razorpay Key Secret (server-side only).
====================================================== */

const crypto = require("crypto");

module.exports = async (req, res) => {

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
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ verified: false, error: "Missing payment fields" });
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const verified = expectedSignature === razorpay_signature;

        return res.status(200).json({
            verified,
            paymentId: verified ? razorpay_payment_id : null
        });

    } catch (err) {
        console.error("verify-payment error:", err);
        return res.status(500).json({ verified: false, error: "Verification failed" });
    }
};
