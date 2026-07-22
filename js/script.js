const showcase = document.querySelector(".showcase img");

if (showcase) {

    const observer = new IntersectionObserver((entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                showcase.style.opacity = "1";
                showcase.style.transform = "translateY(0px) scale(1)";
                showcase.style.filter = "blur(0px)";

            }

        });

    }, {
        threshold: 0.25
    });

    observer.observe(showcase);

}

/* COLLECTION CARDS */

const cards = document.querySelectorAll(".collection-card");

const cardObserver = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            entry.target.classList.add("show");

        }

    });

}, {
    threshold: 0.15
});

cards.forEach(card => {

    cardObserver.observe(card);

});

/* ==========================================
        MOBILE NAV TOGGLE
========================================== */

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".menu");

if (menuToggle && mobileMenu) {

    menuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle("active");
    });

    // Close the menu after tapping a link
    mobileMenu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            mobileMenu.classList.remove("active");
        });
    });

    // Close the menu when tapping outside of it
    document.addEventListener("click", (e) => {
        if (
            mobileMenu.classList.contains("active") &&
            !mobileMenu.contains(e.target) &&
            !menuToggle.contains(e.target)
        ) {
            mobileMenu.classList.remove("active");
        }
    });

}

/* ==========================================
    PAGE LOADER
========================================== */

window.addEventListener("load", () => {

    const loader = document.getElementById("loader");

    if (!loader) return;

    setTimeout(() => {

        loader.classList.add("loader-hide");

    }, 2800);

});

/* ==========================================
        CURSOR GLOW
========================================== */

const glow = document.getElementById("cursor-glow");

if (glow) {

    document.addEventListener("mousemove", (e) => {

        glow.style.left = e.clientX + "px";
        glow.style.top = e.clientY + "px";

    });

}
/* ==========================================
        SCROLL REVEAL
========================================== */

const reveals = document.querySelectorAll(".reveal");

function revealSections() {

    reveals.forEach(section => {

        const top = section.getBoundingClientRect().top;

        const windowHeight = window.innerHeight;

        if (top < windowHeight - 120) {

            section.classList.add("active");

        }

    });

}

window.addEventListener("scroll", revealSections);

revealSections();

/* ==========================================
        NAVBAR SCROLL
========================================== */

const navbar = document.querySelector("nav");

window.addEventListener("scroll", () => {

    if (window.scrollY > 80) {

        navbar.classList.add("scrolled");

    } else {

        navbar.classList.remove("scrolled");

    }

});

/* ==========================================
        COLLECTION PRODUCT GRID
        (works on any collection page — the
        grid container's data-category attribute
        decides which products are shown)
========================================== */

const productGrid = document.getElementById("productGrid");

if (productGrid && typeof products !== "undefined") {

    const categoryName = productGrid.dataset.category;

    const categoryProducts = products.filter(product =>
        product.category === categoryName
    );

    productGrid.innerHTML = "";

    categoryProducts.forEach(product => {

        const mainImg = `images/${product.folder}/${product.cover}`;
        const hoverImg = `images/${product.folder}/${product.gallery[1] || product.cover}`;

        productGrid.innerHTML += `

<div class="product-card">

    ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}

    <img
        class="product-image"
        src="${mainImg}"
        data-main="${mainImg}"
        data-hover="${hoverImg}"
        alt="${product.name}">

    <h3>${product.name}</h3>

    <p class="product-description">
        ${product.description}
    </p>

    <div class="price-row">

        <span class="price">
            ₹${product.price}
        </span>

        <a
            href="product.html?product=${product.slug}"
            class="product-btn">

            View Product

        </a>

    </div>

</div>

`;

    });

    /* Hover Image Swap */

    const images = productGrid.querySelectorAll(".product-image");

    images.forEach(img => {

        img.addEventListener("mouseenter", () => {
            img.src = img.dataset.hover;
        });

        img.addEventListener("mouseleave", () => {
            img.src = img.dataset.main;
        });

    });

    /* Staggered fade-in for product cards as they enter view */

    const cards = productGrid.querySelectorAll(".product-card");

    cards.forEach((card, i) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(24px)";
        card.style.transition = `opacity .5s ease ${i * 70}ms, transform .5s ease ${i * 70}ms`;
    });

    const gridObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
                gridObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    cards.forEach(card => gridObserver.observe(card));

}