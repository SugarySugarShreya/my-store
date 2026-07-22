/* ======================================================
    CREATE SHIPMOZO SHIPPING ORDER
    Runs on the server (Vercel serverless function).
    Called automatically right after a Razorpay payment is
    verified, so a Shipmozo forward order (and AWB) gets
    generated without any manual step.

    Best-effort: this never breaks checkout. The customer
    has already paid by the time this runs, so on failure we
    log the error and return 200 — the order can be pushed
    to Shipmozo manually from your panel, or you can build a
    retry job off the logged error.

    Set these in your Vercel project settings:
      SHIPMOZO_PUBLIC_KEY
      SHIPMOZO_PRIVATE_KEY
      SHIPMOZO_WAREHOUSE_ID
====================================================== */

const { createForwardOrder } = require("../lib/shipmozo");

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

    const publicKey = process.env.SHIPMOZO_PUBLIC_KEY;
    const privateKey = process.env.SHIPMOZO_PRIVATE_KEY;

    // If Shipmozo isn't configured yet, don't break checkout —
    // just report that shipment creation was skipped.
    if (!publicKey || !privateKey) {
        return res.status(200).json({ created: false, reason: "not-configured" });
    }

    try {
        const { customer, cart, subtotal, orderId, paymentId } = req.body || {};

        if (!customer?.name || !customer?.phone || !customer?.address || !customer?.pincode) {
            return res.status(400).json({
                created: false,
                error: "Missing consignee details (name, phone, address, pincode)",
            });
        }

        if (!/^\d{6}$/.test(String(customer.pincode))) {
            return res.status(400).json({ created: false, error: "Invalid pincode" });
        }

        if (!Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ created: false, error: "Empty cart" });
        }

        const result = await createForwardOrder({
            // Fall back to the payment id, then a timestamp, so a
            // shipment can still be created even if the Razorpay
            // order id wasn't passed through for some reason.
            orderId: orderId || paymentId || `sl_${Date.now()}`,
            paymentType: "prepaid", // this store is online-payment-only — no COD
            consignee: {
                name: customer.name,
                phone: customer.phone,
                email: customer.email || "",
                address: customer.address,
                city: customer.city,
                state: customer.state,
                pincode: customer.pincode,
            },
            items: cart.map((i) => ({
                name: i.name,
                sku: i.slug,
                qty: i.qty,
                price: i.price,
            })),
            subtotal,
        });

        return res.status(200).json({
            created: true,
            shipmozoOrderId: result?.order_id || result?.data?.order_id || null,
            awb: result?.awb || result?.data?.awb || null,
            courier: result?.courier_name || result?.data?.courier_name || null,
        });

    } catch (err) {
        console.error("create-shipment error:", err.code, err.message, err.response || "");

        // Still never fail checkout because of a shipping problem —
        // the customer has already paid.
        return res.status(200).json({
            created: false,
            error: err.message || "shipment-creation-failed",
        });
    }
};
