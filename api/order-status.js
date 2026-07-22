/* ======================================================
    ORDER / SHIPMENT STATUS
    Runs on the server (Vercel serverless function).
    Looks up the live shipping status of an order from
    Shipmozo, by Shipmozo order id or AWB number.

    GET /api/order-status?orderId=sl_1234567890
    GET /api/order-status?awb=1234567890123

    Set these in your Vercel project settings:
      SHIPMOZO_PUBLIC_KEY
      SHIPMOZO_PRIVATE_KEY
====================================================== */

const { trackOrder } = require("../lib/shipmozo");

module.exports = async (req, res) => {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const publicKey = process.env.SHIPMOZO_PUBLIC_KEY;
    const privateKey = process.env.SHIPMOZO_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        return res.status(200).json({ found: false, reason: "not-configured" });
    }

    try {
        const orderId = typeof req.query.orderId === "string" ? req.query.orderId.trim() : "";
        const awb = typeof req.query.awb === "string" ? req.query.awb.trim() : "";

        if (!orderId && !awb) {
            return res.status(400).json({ found: false, error: "Provide orderId or awb" });
        }

        const result = await trackOrder({ orderId: orderId || undefined, awb: awb || undefined });

        return res.status(200).json({
            found: true,
            status: result?.status || result?.data?.status || null,
            courier: result?.courier_name || result?.data?.courier_name || null,
            awb: result?.awb || result?.data?.awb || awb || null,
            trackingHistory: result?.tracking_history || result?.data?.tracking_history || [],
        });

    } catch (err) {
        console.error("order-status error:", err.code, err.message, err.response || "");

        if (err.code === "INVALID_INPUT") {
            return res.status(400).json({ found: false, error: err.message });
        }

        if (err.code === "TIMEOUT" || err.code === "NETWORK_ERROR") {
            return res.status(504).json({ found: false, error: "Shipmozo did not respond in time" });
        }

        return res.status(502).json({ found: false, error: "Could not fetch shipment status" });
    }
};
