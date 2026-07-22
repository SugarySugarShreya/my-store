/* ======================================================
    SHIPMOZO API CLIENT
    Thin wrapper around Shipmozo's shipping API. Every
    Shipmozo credential stays server-side only — nothing
    here ever reaches the browser.

    Set these in your Vercel project settings:
      SHIPMOZO_PUBLIC_KEY     -> Shipmozo panel > Settings > API
      SHIPMOZO_PRIVATE_KEY    -> Shipmozo panel > Settings > API
      SHIPMOZO_WAREHOUSE_ID   -> the pickup address / warehouse ID
                                  configured in your Shipmozo panel
                                  (Settings > Pickup Address)
      SHIPMOZO_PICKUP_PINCODE -> the pincode of that same pickup
                                  address (needed for the pincode
                                  serviceability check)
====================================================== */

const BASE_URL = "https://shipping-api.com/app/api/v1";

const ENDPOINTS = {
    pushOrder: "/push-order",
    trackOrder: "/track-order",
    cancelOrder: "/cancel-order",
    checkPincode: "/pincode-serviceability",
};

function getCredentials() {
    const publicKey = process.env.SHIPMOZO_PUBLIC_KEY;
    const privateKey = process.env.SHIPMOZO_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        const err = new Error("Shipmozo credentials are not configured");
        err.code = "NOT_CONFIGURED";
        throw err;
    }

    return { publicKey, privateKey };
}

async function shipmozoRequest(path, { method = "POST", body, query } = {}) {
    const { publicKey, privateKey } = getCredentials();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const qs = query
        ? "?" + new URLSearchParams(query).toString()
        : "";

    let res;
    try {
        res = await fetch(`${BASE_URL}${path}${qs}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "public-key": publicKey,
                "private-key": privateKey,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
    } catch (err) {
        if (err.name === "AbortError") {
            const timeoutErr = new Error("Shipmozo request timed out");
            timeoutErr.code = "TIMEOUT";
            throw timeoutErr;
        }
        const netErr = new Error(`Shipmozo network error: ${err.message}`);
        netErr.code = "NETWORK_ERROR";
        throw netErr;
    } finally {
        clearTimeout(timeoutId);
    }

    let data = null;
    try {
        data = await res.json();
    } catch {
        // Non-JSON response — fall through with data = null.
    }

    if (!res.ok) {
        const err = new Error(
            (data && (data.message || data.error)) || `Shipmozo returned HTTP ${res.status}`
        );
        err.code = "API_ERROR";
        err.status = res.status;
        err.response = data;
        throw err;
    }

    // Shipmozo can return HTTP 200 even when the order was rejected —
    // the real result is inside the JSON body. Log it so failures are
    // visible, and treat a non-success body as an error too.
    console.log("Shipmozo raw response:", JSON.stringify(data));

    if (data && (data.status === 0 || data.status === "0" || data.result_code === 0)) {
        const err = new Error(data.message || data.msg || "Shipmozo rejected the order");
        err.code = "API_LOGICAL_ERROR";
        err.response = data;
        throw err;
    }

    return data;
}

/**
 * Create a forward shipping order in Shipmozo for a paid-online order.
 */
async function createForwardOrder({
    orderId,
    orderDate,
    paymentType = "prepaid",
    consignee,
    items,
    codAmount = "",
    weightGrams = 300,
    dimensionsCm = { length: 15, width: 12, height: 6 },
}) {
    const warehouseId = process.env.SHIPMOZO_WAREHOUSE_ID;
    if (!warehouseId) {
        const err = new Error("SHIPMOZO_WAREHOUSE_ID is not configured");
        err.code = "NOT_CONFIGURED";
        throw err;
    }

    if (!consignee || !consignee.name || !consignee.phone || !consignee.pincode) {
        const err = new Error("Missing required consignee fields (name, phone, pincode)");
        err.code = "INVALID_INPUT";
        throw err;
    }

    if (!Array.isArray(items) || items.length === 0) {
        const err = new Error("At least one order item is required");
        err.code = "INVALID_INPUT";
        throw err;
    }

    const payload = {
        order_id: orderId,
        order_date: orderDate || new Date().toISOString().slice(0, 10),

        consignee_name: consignee.name,
        consignee_phone: Number(consignee.phone),
        consignee_alternate_phone: Number(consignee.alternatePhone || consignee.phone),
        consignee_email: consignee.email || "",
        consignee_address_line_one: consignee.addressLine1 || consignee.address || "",
        consignee_address_line_two: consignee.addressLine2 || "",
        consignee_pin_code: Number(consignee.pincode),
        consignee_city: consignee.city,
        consignee_state: consignee.state,

        product_detail: items.map((i) => ({
            name: i.name,
            sku_number: i.sku || String(i.name || "item").toLowerCase().replace(/\s+/g, "-"),
            quantity: i.qty,
            discount: i.discount || "",
            hsn: i.hsn || "",
            unit_price: i.price,
            product_category: i.category || "Other",
        })),

        payment_type: paymentType === "cod" ? "COD" : "PREPAID",
        cod_amount: paymentType === "cod" ? codAmount : "",
        shipping_charges: "",

        weight: weightGrams,
        length: dimensionsCm.length,
        width: dimensionsCm.width,
        height: dimensionsCm.height,

        warehouse_id: warehouseId,
        gst_ewaybill_number: "",
        gstin_number: "",
    };

    return shipmozoRequest(ENDPOINTS.pushOrder, { body: payload });
}

/**
 * Look up the live status of a shipment by Shipmozo order id or AWB.
 */
async function trackOrder({ orderId, awb }) {
    if (!orderId && !awb) {
        const err = new Error("orderId or awb is required to track a shipment");
        err.code = "INVALID_INPUT";
        throw err;
    }
    return shipmozoRequest(ENDPOINTS.trackOrder, {
        method: "GET",
        query: awb ? { awb_number: awb } : { order_id: orderId },
    });
}

/**
 * Cancel a previously created shipment.
 */
async function cancelOrder({ orderId, awb }) {
    if (!orderId && !awb) {
        const err = new Error("orderId or awb is required to cancel a shipment");
        err.code = "INVALID_INPUT";
        throw err;
    }
    return shipmozoRequest(ENDPOINTS.cancelOrder, {
        body: awb ? { awb } : { order_id: orderId },
    });
}

/**
 * Check whether a pincode is currently serviceable from your warehouse.
 */
async function checkPincodeServiceability({ pincode }) {
    if (!pincode) {
        const err = new Error("pincode is required");
        err.code = "INVALID_INPUT";
        throw err;
    }

    const pickupPincode = process.env.SHIPMOZO_PICKUP_PINCODE;
    if (!pickupPincode) {
        const err = new Error("SHIPMOZO_PICKUP_PINCODE is not configured");
        err.code = "NOT_CONFIGURED";
        throw err;
    }

    return shipmozoRequest(ENDPOINTS.checkPincode, {
        body: {
            pickup_pincode: Number(pickupPincode),
            delivery_pincode: Number(pincode),
        },
    });
}

module.exports = {
    createForwardOrder,
    trackOrder,
    cancelOrder,
    checkPincodeServiceability,
};
