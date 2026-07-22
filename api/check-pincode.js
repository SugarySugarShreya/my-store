/* ======================================================
    PINCODE SERVICEABILITY CHECK
    Runs on the server (Vercel serverless function).
    Lets the checkout form warn a customer, before they pay,
    if Shipmozo currently can't deliver to their pincode.
    GET /api/check-pincode?pincode=560001
    Set these in your Vercel project settings:
      SHIPMOZO_PUBLIC_KEY
      SHIPMOZO_PRIVATE_KEY
      SHIPMOZO_PICKUP_PINCODE
====================================================== */
const { checkPincodeServiceability } = require("../lib/shipmozo");
module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    const publicKey = process.env.SHIPMOZO_PUBLIC_KEY;
    const privateKey = process.env.SHIPMOZO_PRIVATE_KEY;
    const pickupPincode = process.env.SHIPMOZO_PICKUP_PINCODE;
    if (!publicKey || !privateKey || !pickupPincode) {
        return res.status(200).json({ checked: false, serviceable: true, reason: "not-configured" });
    }
    try {
        const pincode = String(req.query.pincode || "").trim();
        if (!/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ checked: false, error: "Invalid pincode" });
        }
        const result = await checkPincodeServiceability({ pincode });
        const serviceable = result?.serviceable ?? result?.data?.serviceable;
        return res.status(200).json({
            checked: true,
            serviceable: serviceable === undefined ? true : !!serviceable,
        });
    } catch (err) {
        console.error("check-pincode error:", err.code, err.message);
        return res.status(200).json({ checked: false, serviceable: true, error: "check-failed" });
    }
};
