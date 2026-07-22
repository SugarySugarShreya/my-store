/* ======================================================
    LOG ORDER TO GOOGLE SHEETS
    Runs on the server (Vercel serverless function).
    Forwards order details to a Google Apps Script "Web
    App" URL, which writes a new row into your Google
    Sheet. Nothing is stored here — the Sheet is the
    source of truth.

    If the customer uploaded photo(s) for a personalized
    product (Spotify Plaque, Canvas, Number Plate Keychain),
    those are included as base64 image data in
    payload.customizations — your Apps Script decides what
    to do with them (e.g. save to Drive and put a link in
    the sheet).

    Set this in your Vercel project settings:
      GOOGLE_SHEET_WEBHOOK_URL   → the Apps Script Web App URL

    See GOOGLE-SHEETS-SETUP.md for the exact steps and an
    example Apps Script to paste into your Sheet.
====================================================== */

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

    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;

    // If the Sheet isn't configured yet, don't break checkout —
    // just tell the browser it was skipped.
    if (!webhookUrl) {
        return res.status(200).json({ logged: false, reason: "not-configured" });
    }

    try {
        const { customer, cart, subtotal, paymentId, orderId } = req.body;

        if (!Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ logged: false, error: "Empty cart" });
        }

        const itemsSummary = cart
            .map(i => `${i.name}${i.size ? ` (${i.size})` : ""} x${i.qty}`)
            .join(", ");

        // One entry per cart line that has an uploaded photo and/or
        // customization notes (Spotify Plaques, Canvas, Keychains).
        const customizations = cart
            .filter(i => i.customization && (i.customization.notes || (i.customization.photos || []).length))
            .map(i => ({
                item: i.name,
                qty: i.qty,
                notes: i.customization.notes || "",
                photos: i.customization.photos || [], // base64 data URLs (image/jpeg)
            }));

        const payload = {
            timestamp: new Date().toISOString(),
            orderId: orderId || "",
            paymentId: paymentId || "",
            name: customer?.name || "",
            phone: customer?.phone || "",
            address: customer?.address || "",
            items: itemsSummary,
            total: subtotal || 0,
            customizations,
        };

        const sheetRes = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!sheetRes.ok) {
            throw new Error(`Sheet webhook returned ${sheetRes.status}`);
        }

        return res.status(200).json({ logged: true });

    } catch (err) {
        console.error("log-order error:", err);
        // Never fail the checkout because of a logging problem —
        // the customer has already paid.
        return res.status(200).json({ logged: false, error: "log-failed" });
    }
};
