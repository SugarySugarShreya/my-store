/* ======================================================
                SHOPPING CART
    Handles cart storage, the sliding cart drawer,
    the checkout steps, and payment.
    Include this file on every page (after config.js).
====================================================== */

(function () {

    const CART_KEY = "sl_cart";
    const CUSTOMER_KEY = "sl_customer";

    // Serverless functions live at /api/... on whatever domain the site
    // is deployed to (Vercel auto-detects the /api folder). No need to
    // change this unless you're pointing at a different backend.
    const API_BASE = "";

    let razorpayScriptLoaded = false;

    function loadRazorpayScript() {
        return new Promise((resolve, reject) => {
            if (razorpayScriptLoaded || window.Razorpay) {
                razorpayScriptLoaded = true;
                return resolve();
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => {
                razorpayScriptLoaded = true;
                resolve();
            };
            script.onerror = () => reject(new Error("Could not load Razorpay checkout"));
            document.head.appendChild(script);
        });
    }

    /* ==================================================
        STORAGE HELPERS
    ================================================== */

    function getCart() {
        try {
            return JSON.parse(localStorage.getItem(CART_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        renderCart();
        updateCartBadge();
    }

    function getCustomer() {
        try {
            return JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    function saveCustomer(data) {
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data));
    }

    function cartLineId(slug, size) {
        return size ? `${slug}__${size}` : slug;
    }

    function addToCart(product, qty, size, customization) {

        const cart = getCart();

        // Customized items (photo + notes) each represent a distinct
        // personalization, so they always get their own line instead
        // of merging quantity into an existing line.
        const hasCustomization = !!(customization && (customization.photos?.length || customization.notes));
        const lineId = hasCustomization
            ? `${cartLineId(product.slug, size)}__${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            : cartLineId(product.slug, size);

        const existing = !hasCustomization && cart.find(item => item.lineId === lineId);

        if (existing) {
            existing.qty += qty;
        } else {
            cart.push({
                lineId,
                slug: product.slug,
                name: product.name,
                price: product.price,
                image: `images/${product.folder}/${product.cover}`,
                size: size || null,
                qty,
                customization: hasCustomization
                    ? { notes: customization.notes || "", photos: customization.photos || [] }
                    : null
            });
        }

        saveCart(cart);
        openDrawer();
        showStep("cart");
    }

    function updateQty(lineId, delta) {
        const cart = getCart();
        const item = cart.find(i => i.lineId === lineId);
        if (!item) return;

        item.qty += delta;

        if (item.qty <= 0) {
            saveCart(cart.filter(i => i.lineId !== lineId));
        } else {
            saveCart(cart);
        }
    }

    function removeItem(lineId) {
        saveCart(getCart().filter(i => i.lineId !== lineId));
    }

    function getSubtotal() {
        return getCart().reduce((sum, i) => sum + (i.price * i.qty), 0);
    }

    function getItemCount() {
        return getCart().reduce((sum, i) => sum + i.qty, 0);
    }

    function clearCart() {
        saveCart([]);
    }

    /* ==================================================
        UI INJECTION
    ================================================== */

    function injectCartUI() {

        // ---- Sticky cart icon in navbar ----

        const navActions = document.querySelector(".nav-actions");

        if (navActions && !document.getElementById("cartIconBtn")) {

            const cartBtn = document.createElement("button");
            cartBtn.id = "cartIconBtn";
            cartBtn.className = "cart-icon-btn";
            cartBtn.setAttribute("aria-label", "Open cart");
            cartBtn.innerHTML = `
                <span class="cart-icon-glyph">🛍</span>
                <span class="cart-count" id="cartCount">0</span>
            `;

            navActions.insertBefore(cartBtn, navActions.firstChild);

            cartBtn.addEventListener("click", () => {
                openDrawer();
                showStep("cart");
            });
        }

        // ---- Drawer + overlay ----

        if (!document.getElementById("cartOverlay")) {

            const overlay = document.createElement("div");
            overlay.id = "cartOverlay";
            overlay.className = "cart-overlay";

            overlay.innerHTML = `
                <aside class="cart-drawer" id="cartDrawer" role="dialog" aria-label="Shopping cart">

                    <div class="cart-drawer-header">
                        <h3 id="cartDrawerTitle">Your Cart</h3>
                        <button class="cart-close-btn" id="cartCloseBtn" aria-label="Close cart">✕</button>
                    </div>

                    <div class="cart-drawer-body">

                        <!-- STEP: CART -->
                        <div class="cart-step" id="stepCart">
                            <div id="cartItemsList" class="cart-items-list"></div>
                        </div>

                        <!-- STEP: DETAILS -->
                        <div class="cart-step" id="stepDetails" style="display:none;">

                            <p class="cart-step-back" id="backToCart">← Back to cart</p>

                            <form id="customerForm" class="customer-form">

                                <label>Full Name
                                    <input type="text" id="custName" required placeholder="Your name">
                                </label>

                                <label>Phone Number
                                    <input type="tel" id="custPhone" required placeholder="10-digit mobile number">
                                </label>

                                <label>Delivery Address
                                    <textarea id="custAddress" required placeholder="House no, street, locality" rows="3"></textarea>
                                </label>

                                <div class="customer-form-row">
                                    <label>City
                                        <input type="text" id="custCity" required placeholder="City">
                                    </label>

                                    <label>State
                                        <input type="text" id="custState" required placeholder="State">
                                    </label>
                                </div>

                                <label>Pincode
                                    <input type="text" id="custPincode" required inputmode="numeric" maxlength="6" placeholder="6-digit pincode">
                                    <span id="pincodeStatus" class="pincode-status"></span>
                                </label>

                                <p class="payment-note">
                                    Payment is collected securely online via UPI,
                                    Netbanking, Debit Card or Credit Card in the next step.
                                </p>

                                <button type="submit" class="cart-primary-btn">Review Order</button>

                            </form>

                        </div>

                        <!-- STEP: REVIEW -->
                        <div class="cart-step" id="stepReview" style="display:none;">

                            <p class="cart-step-back" id="backToDetails">← Back to details</p>

                            <div id="reviewSummary" class="review-summary"></div>

                            <p id="paymentStatus" class="payment-status" style="display:none;"></p>

                            <button class="cart-primary-btn cart-pay-btn" id="payRazorpayBtn">
                                Pay ₹<span id="payAmount">0</span> Securely
                            </button>

                            <p class="payment-methods-note">
                                UPI · Netbanking · Debit Card · Credit Card
                            </p>

                            <p class="delivery-estimate-note">
                                📦 Estimated delivery: 6-7 days after payment
                            </p>

                        </div>

                    </div>

                    <div class="cart-drawer-footer" id="cartFooter">
                        <div class="cart-subtotal-row">
                            <span>Subtotal</span>
                            <span id="cartSubtotal">₹0</span>
                        </div>
                        <button class="cart-secondary-btn" id="continueShoppingBtn">Continue Shopping</button>
                        <button class="cart-primary-btn" id="proceedCheckoutBtn">Proceed to Checkout</button>
                    </div>

                </aside>
            `;

            document.body.appendChild(overlay);

            // Event wiring

            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) closeDrawer();
            });

            document.getElementById("cartCloseBtn").addEventListener("click", closeDrawer);
            document.getElementById("continueShoppingBtn").addEventListener("click", closeDrawer);

            document.getElementById("proceedCheckoutBtn").addEventListener("click", () => {
                if (getCart().length === 0) return;
                showStep("details");
            });

            document.getElementById("backToCart").addEventListener("click", () => showStep("cart"));
            document.getElementById("backToDetails").addEventListener("click", () => showStep("details"));

            document.getElementById("customerForm").addEventListener("submit", (e) => {
                e.preventDefault();

                saveCustomer({
                    name: document.getElementById("custName").value.trim(),
                    phone: document.getElementById("custPhone").value.trim(),
                    address: document.getElementById("custAddress").value.trim(),
                    city: document.getElementById("custCity").value.trim(),
                    state: document.getElementById("custState").value.trim(),
                    pincode: document.getElementById("custPincode").value.trim(),
                    payment: "Pay Online"
                });

                renderReview();
                showStep("review");
            });

            // Best-effort pincode serviceability check — never blocks
            // checkout, just warns the customer up front if Shipmozo
            // can't currently deliver to that pincode.
            document.getElementById("custPincode").addEventListener("blur", checkPincodeServiceability);

            document.getElementById("payRazorpayBtn").addEventListener("click", startRazorpayPayment);

            // Delegate qty/remove clicks inside cart items list
            document.getElementById("cartItemsList").addEventListener("click", (e) => {

                const lineId = e.target.closest("[data-line-id]")?.dataset.lineId;
                if (!lineId) return;

                if (e.target.classList.contains("qty-plus")) updateQty(lineId, 1);
                if (e.target.classList.contains("qty-minus")) updateQty(lineId, -1);
                if (e.target.classList.contains("remove-item")) removeItem(lineId);
            });

            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") closeDrawer();
            });
        }

        renderCart();
        updateCartBadge();
    }

    /* ==================================================
        RENDERING
    ================================================== */

    function renderCart() {

        const list = document.getElementById("cartItemsList");
        if (!list) return;

        const cart = getCart();
        const subtotalEl = document.getElementById("cartSubtotal");
        const footer = document.getElementById("cartFooter");

        if (cart.length === 0) {
            list.innerHTML = `
                <div class="cart-empty">
                    <p class="cart-empty-emoji">🖤</p>
                    <p>Your cart feels lonely</p>
                    <span>Add something beautiful to it.</span>
                </div>
            `;
            if (footer) footer.classList.add("cart-footer-disabled");
        } else {
            list.innerHTML = cart.map(item => `
                <div class="cart-item" data-line-id="${item.lineId}">

                    <img src="${item.image}" alt="${item.name}">

                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        ${item.size ? `<span class="cart-item-size">Size: ${item.size}</span>` : ""}
                        ${item.customization ? `<span class="cart-item-size">📷 ${item.customization.photos.length} photo${item.customization.photos.length === 1 ? "" : "s"}${item.customization.notes ? ` · "${item.customization.notes}"` : ""}</span>` : ""}
                        <span class="cart-item-price">₹${item.price}</span>

                        <div class="cart-qty-control">
                            <button class="qty-minus">−</button>
                            <span>${item.qty}</span>
                            <button class="qty-plus">+</button>
                        </div>
                    </div>

                    <button class="remove-item" aria-label="Remove item">✕</button>

                </div>
            `).join("");

            if (footer) footer.classList.remove("cart-footer-disabled");
        }

        if (subtotalEl) subtotalEl.textContent = `₹${getSubtotal()}`;
    }

    function renderReview() {

        const cart = getCart();
        const customer = getCustomer();
        const summary = document.getElementById("reviewSummary");
        if (!summary) return;

        summary.innerHTML = `
            <div class="review-items">
                ${cart.map(i => `
                    <div class="review-line">
                        <span>${i.name}${i.size ? ` (${i.size})` : ""} × ${i.qty}${i.customization ? ` — 📷 ${i.customization.photos.length} photo${i.customization.photos.length === 1 ? "" : "s"} uploaded` : ""}</span>
                        <span>₹${i.price * i.qty}</span>
                    </div>
                `).join("")}
            </div>

            <div class="review-total-row">
                <span>Total</span>
                <span>₹${getSubtotal()}</span>
            </div>

            <div class="review-customer">
                <p><strong>${customer.name || ""}</strong></p>
                <p>${customer.phone || ""}</p>
                <p>${customer.address || ""}</p>
                <p>${[customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")}</p>
                <p>Payment: ${customer.payment || ""}</p>
            </div>
        `;

        const payBtn = document.getElementById("payRazorpayBtn");
        const statusEl = document.getElementById("paymentStatus");

        statusEl.style.display = "none";
        statusEl.textContent = "";

        payBtn.disabled = false;
        payBtn.querySelector("#payAmount").textContent = getSubtotal();
    }

    function updateCartBadge() {
        const badge = document.getElementById("cartCount");
        if (!badge) return;

        const count = getItemCount();
        badge.textContent = count;
        badge.style.display = count > 0 ? "flex" : "none";
    }

    function showStep(step) {
        ["Cart", "Details", "Review"].forEach(s => {
            const el = document.getElementById(`step${s}`);
            if (el) el.style.display = (s.toLowerCase() === step) ? "block" : "none";
        });

        const footer = document.getElementById("cartFooter");
        const title = document.getElementById("cartDrawerTitle");

        if (footer) footer.style.display = (step === "cart") ? "flex" : "none";

        if (title) {
            title.textContent = step === "cart"
                ? "Your Cart"
                : step === "details"
                    ? "Your Details"
                    : "Review Order";
        }

        if (step === "cart") renderCart();
    }

    function openDrawer() {
        const overlay = document.getElementById("cartOverlay");
        if (overlay) overlay.classList.add("cart-overlay-open");
        document.body.style.overflow = "hidden";
    }

    function closeDrawer() {
        const overlay = document.getElementById("cartOverlay");
        if (overlay) overlay.classList.remove("cart-overlay-open");
        document.body.style.overflow = "";
    }

async function checkPincodeServiceability() {

    const input = document.getElementById("custPincode");
    const statusEl = document.getElementById("pincodeStatus");
    if (!input || !statusEl) return;

    const pincode = input.value.trim();

    // Hide any pincode message
    statusEl.textContent = "";
    statusEl.classList.remove("pincode-status-error");

    if (!/^\d{6}$/.test(pincode)) return;

    try {
        // Optional: still call the API so it keeps working in the background
        await fetch(`${API_BASE}/api/check-pincode?pincode=${pincode}`);

        // Don't show any success or error message
        statusEl.textContent = "";
    } catch (err) {
        console.error("check-pincode failed:", err);
    }
}
    /* ==================================================
        POST-PAYMENT AUTOMATION
        (Google Sheet order log + Shipmozo shipping order).
        All best-effort — if not configured yet, or if any
        call fails, checkout still completes since the
        payment has already gone through.
    ================================================== */

    // Strips photo data URLs out of the cart before sending it to
    // endpoints that don't need them (create-order / create-shipment),
    // so those requests stay small and fast. The full customization —
    // including photos — is only sent to log-order, which forwards it
    // to your Google Sheet webhook.
    function cartWithoutPhotos(cart) {
        return cart.map(item => {
            if (!item.customization) return item;
            const { photos, ...rest } = item.customization;
            return { ...item, customization: { ...rest, photos: undefined } };
        });
    }

    function notifyOrderPlaced({ paymentId, orderId } = {}) {

        const cart = getCart();
        const customer = getCustomer();
        const subtotal = getSubtotal();

        const lightPayload = {
            customer,
            cart: cartWithoutPhotos(cart),
            subtotal,
            paymentId: paymentId || null,
            orderId: orderId || null
        };

        // Full payload (with photos) goes only to the sheet logger.
        const sheetPayload = {
            ...lightPayload,
            cart
        };

        fetch(`${API_BASE}/api/log-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sheetPayload)
        }).catch(err => console.error("log-order failed:", err));

        fetch(`${API_BASE}/api/create-shipment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lightPayload)
        }).catch(err => console.error("create-shipment failed:", err));
    }

    /* ==================================================
        RAZORPAY PAYMENT (UPI / NETBANKING)
    ================================================== */

    function setPaymentStatus(text, isError) {
        const statusEl = document.getElementById("paymentStatus");
        if (!statusEl) return;
        statusEl.style.display = "block";
        statusEl.textContent = text;
        statusEl.classList.toggle("payment-status-error", !!isError);
    }

    async function startRazorpayPayment() {

        const cart = getCart();
        if (cart.length === 0) return;

        const customer = getCustomer();
        const payBtn = document.getElementById("payRazorpayBtn");
        const amount = getSubtotal();

        payBtn.disabled = true;
        setPaymentStatus("Setting up secure payment…");

        try {
            await loadRazorpayScript();

            const orderRes = await fetch(`${API_BASE}/api/create-order`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, cart: cartWithoutPhotos(cart) })
            });

            if (!orderRes.ok) throw new Error("order-create-failed");

            const order = await orderRes.json();

            const options = {
                key: order.keyId,
                amount: order.amount,
                currency: order.currency,
                name: "Soft Launch",
                description: "Order Payment",
                order_id: order.orderId,

                // UPI, Netbanking, Debit Card and Credit Card are all
                // shown. No Cash on Delivery — this is online-payment-only.
                // Wallets/EMI/Paylater stay off to keep checkout simple.
                method: {
                    netbanking: true,
                    upi: true,
                    card: true,
                    wallet: false,
                    emi: false,
                    paylater: false
                },

                // Shows every UPI app installed on the customer's phone
                // (GPay, PhonePe, Paytm, etc.) plus a QR/collect option.
                config: {
                    display: {
                        blocks: {
                            upi: {
                                name: "Pay via UPI",
                                instruments: [{ method: "upi" }]
                            },
                            other: {
                                name: "Other Payment Methods",
                                instruments: [
                                    { method: "card" },
                                    { method: "netbanking" }
                                ]
                            }
                        },
                        sequence: ["block.upi", "block.other"],
                        preferences: { show_default_blocks: false }
                    }
                },

                prefill: {
                    name: customer.name || "",
                    contact: customer.phone || ""
                },

                theme: { color: "#8b1018" },

                handler: async function (response) {
                    setPaymentStatus("Verifying payment…");

                    try {
                        const verifyRes = await fetch(`${API_BASE}/api/verify-payment`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(response)
                        });

                        const result = await verifyRes.json();

                        if (result.verified) {
                            setPaymentStatus("Payment successful ✓ Confirming your order…");
                            notifyOrderPlaced({ paymentId: result.paymentId, orderId: order.orderId });
                            clearCart();

                            // The calls inside notifyOrderPlaced() are fire-and-forget
                            // (sheet logging, shipment) so we don't make the
                            // customer wait on them. Show the final confirmation
                            // right away — their payment already succeeded.
                            setPaymentStatus("Order confirmed! 🎉 We'll get started on your piece right away.");
                        } else {
                            setPaymentStatus("We couldn't verify that payment. Please try again or contact us.", true);
                            payBtn.disabled = false;
                        }
                    } catch (err) {
                        setPaymentStatus("Verification failed. Please contact us for help.", true);
                        payBtn.disabled = false;
                    }
                },

                modal: {
                    ondismiss: function () {
                        setPaymentStatus("Payment cancelled.");
                        payBtn.disabled = false;
                    }
                }
            };

            const rzp = new window.Razorpay(options);

            rzp.on("payment.failed", function () {
                setPaymentStatus("Payment failed. Please try again.", true);
                payBtn.disabled = false;
            });

            rzp.open();
            setPaymentStatus("");

        } catch (err) {
            console.error(err);
            setPaymentStatus("Couldn't start payment. Please check your connection and try again.", true);
            payBtn.disabled = false;
        }
    }

    /* ==================================================
        EXPOSE PUBLIC API
    ================================================== */

    window.SoftLaunchCart = {
        addToCart,
        updateQty,
        removeItem,
        clearCart,
        getCart,
        getSubtotal,
        getItemCount,
        openDrawer,
        closeDrawer
    };

    document.addEventListener("DOMContentLoaded", injectCartUI);

})();
