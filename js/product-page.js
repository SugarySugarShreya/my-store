/* ======================================================
                PRODUCT PAGE
====================================================== */

// Get product slug from URL
const params = new URLSearchParams(window.location.search);
const slug = params.get("product");

// Find matching product across ALL categories
const product = products.find(item => item.slug === slug);

// Redirect if product doesn't exist
if (!product) {
    window.location.href = "collections.html";
}

if (product) {

    // =====================
    // Main Content
    // =====================

    document.title = `Soft Launch | ${product.name}`;

    document.getElementById("productCategory").textContent =
        product.category.toUpperCase();

    document.getElementById("productName").textContent = product.name;

    document.getElementById("productDescription").textContent =
        product.description;

    if (product.category === "Oversized Tees") {
        document.getElementById("teeProductDetails").hidden = false;
    }

    document.getElementById("productPrice").textContent =
        `₹${product.price}`;

    const originalPriceEl = document.getElementById("productOriginalPrice");
    const discountEl = document.getElementById("productDiscount");

    if (product.originalPrice && product.originalPrice > product.price) {
        originalPriceEl.textContent = `₹${product.originalPrice}`;
    } else {
        originalPriceEl.style.display = "none";
    }

    if (product.discount) {
        discountEl.textContent = `${product.discount}% OFF`;
    } else {
        discountEl.style.display = "none";
    }

    // Rating / reviews / stock

    const ratingEl = document.getElementById("productRating");
    const reviewsEl = document.getElementById("productReviews");
    const stockEl = document.getElementById("productStock");

    if (product.rating) {
        ratingEl.textContent = "★★★★★";
    }
    if (product.reviews) {
        reviewsEl.textContent = `(${product.reviews} reviews)`;
    }
    if (product.stock) {
        stockEl.textContent = `• ${product.stock}`;
    }

    // =====================
    // Images
    // =====================

    const imgFolder = `images/${product.folder}`;
    const gallery = product.gallery && product.gallery.length
        ? product.gallery
        : [product.cover, product.cover];

    const mainImage = document.getElementById("mainImage");
    const thumbnailRow = document.getElementById("thumbnailRow");

    mainImage.src = `${imgFolder}/${gallery[0]}`;
    mainImage.alt = product.name;

    // Render as many thumbnails as the product actually has (2, 3, 4+)
    thumbnailRow.innerHTML = gallery
        .map((img, i) => `<img data-i="${i}" class="${i === 0 ? "active" : ""}" src="${imgFolder}/${img}" alt="${product.name} view ${i + 1}">`)
        .join("");

    // Hide the thumbnail row entirely if there's only one image
    thumbnailRow.style.display = gallery.length > 1 ? "flex" : "none";

    thumbnailRow.querySelectorAll("img").forEach(thumb => {
        thumb.addEventListener("click", () => {
            mainImage.style.opacity = 0;
            setTimeout(() => {
                mainImage.src = thumb.src;
                mainImage.style.opacity = 1;
            }, 120);
            thumbnailRow.querySelectorAll("img").forEach(t => t.classList.remove("active"));
            thumb.classList.add("active");
        });
    });

    // =====================
    // Purchase Flow
    // =====================
    // Every product uses the on-site cart and checkout experience.
    // Personalized products (Spotify Plaques, Canvas, Number Plate
    // Keychains) additionally show a photo upload + customization
    // notes block above the cart controls — customers upload their
    // photo(s) and details directly, no WhatsApp needed.

    const cartBlock = document.getElementById("cartPurchaseBlock");
    const noteEl = document.getElementById("productNote");

    cartBlock.style.display = "block";

    noteEl.textContent =
        "Add this to your cart, then checkout securely when you're ready.";

    // ---- Size selector (Oversized Tees only) ----

    const sizeSelector = document.getElementById("sizeSelector");
    const sizeOptions = document.getElementById("sizeOptions");
    let selectedSize = null;

    if (product.category === "Oversized Tees") {

        sizeSelector.style.display = "block";
        const sizes = ["S", "M", "L", "XL", "XXL"];

        sizeOptions.innerHTML = sizes
            .map(size => `<button type="button" class="size-option" data-size="${size}">${size}</button>`)
            .join("");

        selectedSize = sizes[0];
        sizeOptions.querySelector(`[data-size="${selectedSize}"]`).classList.add("active");

        sizeOptions.addEventListener("click", (e) => {
            if (!e.target.classList.contains("size-option")) return;

            sizeOptions.querySelectorAll(".size-option").forEach(btn => btn.classList.remove("active"));
            e.target.classList.add("active");
            selectedSize = e.target.dataset.size;
        });
    }

    // ---- Quantity selector ----

    let qty = 1;
    const qtyValueEl = document.getElementById("qtyValue");

    document.getElementById("qtyMinus").addEventListener("click", () => {
        if (qty > 1) qty--;
        qtyValueEl.textContent = qty;
    });

    document.getElementById("qtyPlus").addEventListener("click", () => {
        qty++;
        qtyValueEl.textContent = qty;
    });

    // ---- Customization (photo upload + notes) ----

    const MAX_PHOTOS = 5;
    const MAX_DIM = 1200; // px, longest side after resize
    const JPEG_QUALITY = 0.75;

    const customizationBlock = document.getElementById("customizationBlock");
    const customizationHint = document.getElementById("customizationHint");
    const customizationNotes = document.getElementById("customizationNotes");
    const photoUploadZone = document.getElementById("photoUploadZone");
    const photoUploadBtn = document.getElementById("photoUploadBtn");
    const photoUploadInput = document.getElementById("photoUploadInput");
    const customizationProcessing = document.getElementById("customizationProcessing");
    const customizationStatus = document.getElementById("customizationStatus");

    let uploadedPhotos = []; // [{ name, dataUrl }]

    function showCustomizationError(text) {
        customizationStatus.textContent = text;
        customizationStatus.classList.add("visible");
    }

    function clearCustomizationError() {
        customizationStatus.textContent = "";
        customizationStatus.classList.remove("visible");
    }

    function renderThumbnails() {
        photoUploadZone
            .querySelectorAll(".photo-thumb")
            .forEach(el => el.remove());

        uploadedPhotos.forEach((photo, i) => {
            const thumb = document.createElement("div");
            thumb.className = "photo-thumb";
            thumb.innerHTML = `<img src="${photo.dataUrl}" alt="Uploaded photo ${i + 1}"><button type="button" aria-label="Remove photo">✕</button>`;
            thumb.querySelector("button").addEventListener("click", () => {
                uploadedPhotos.splice(i, 1);
                renderThumbnails();
            });
            photoUploadZone.insertBefore(thumb, photoUploadBtn);
        });

        photoUploadBtn.disabled = uploadedPhotos.length >= MAX_PHOTOS;
        if (uploadedPhotos.length > 0) clearCustomizationError();
    }

    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > MAX_DIM || height > MAX_DIM) {
                        if (width > height) {
                            height = Math.round(height * MAX_DIM / width);
                            width = MAX_DIM;
                        } else {
                            width = Math.round(width * MAX_DIM / height);
                            height = MAX_DIM;
                        }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
                };
                img.onerror = () => reject(new Error("Could not read image"));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error("Could not read file"));
            reader.readAsDataURL(file);
        });
    }

    if (product.needsPhoto) {

        customizationBlock.style.display = "block";
        if (product.customizationHint) {
            customizationHint.textContent = product.customizationHint;
        }

        photoUploadBtn.addEventListener("click", () => photoUploadInput.click());

        photoUploadInput.addEventListener("change", async () => {
            const files = Array.from(photoUploadInput.files || []);
            photoUploadInput.value = ""; // allow re-selecting the same file later

            const room = MAX_PHOTOS - uploadedPhotos.length;
            if (room <= 0) return;

            const toProcess = files.slice(0, room);
            customizationProcessing.classList.add("visible");

            for (const file of toProcess) {
                try {
                    const dataUrl = await compressImage(file);
                    uploadedPhotos.push({ name: file.name, dataUrl });
                } catch (err) {
                    console.error("Photo processing failed:", err);
                }
            }

            customizationProcessing.classList.remove("visible");
            renderThumbnails();
        });
    }

    // ---- Add to Cart ----

    document.getElementById("addToCartBtn").addEventListener("click", () => {

        if (product.needsPhoto && uploadedPhotos.length === 0) {
            showCustomizationError("Please upload at least one photo before adding to cart.");
            customizationBlock.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }

        const customization = product.needsPhoto
            ? { notes: customizationNotes.value.trim(), photos: uploadedPhotos.map(p => p.dataUrl) }
            : null;

        window.SoftLaunchCart.addToCart(product, qty, selectedSize, customization);

        // Reset for next add
        qty = 1;
        qtyValueEl.textContent = qty;
        uploadedPhotos = [];
        if (product.needsPhoto) {
            customizationNotes.value = "";
            renderThumbnails();
        }
    });

    // =====================
    // Related Products
    // (same category, excluding current product)
    // =====================

    const relatedGrid = document.getElementById("relatedProducts");
    const relatedHeading = document.querySelector(".related-heading");

    let related = products
        .filter(item => item.category === product.category && item.slug !== slug)
        .slice(0, 4);

    // This category only has one flagship (fully-customizable) product —
    // show other best-sellers from across the store instead of an empty section.
    if (related.length === 0) {
        if (relatedHeading) relatedHeading.textContent = "You May Also Like";
        related = products
            .filter(item => item.slug !== slug)
            .slice(0, 4);
    }

    related.forEach(item => {

        const cover = `images/${item.folder}/${item.cover}`;

        relatedGrid.innerHTML += `

<div class="product-card">

    ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ""}

    <img class="product-image" src="${cover}" alt="${item.name}">

    <h3>${item.name}</h3>

    <p class="product-description">
        ${item.description}
    </p>

    <div class="price-row">

        <span class="price">₹${item.price}</span>

        <a class="product-btn" href="product.html?product=${item.slug}">
            View Product
        </a>

    </div>

</div>

`;

    });

}
