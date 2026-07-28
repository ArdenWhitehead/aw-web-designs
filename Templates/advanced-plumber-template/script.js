const searchInput = document.getElementById("product-search");
const productCards = document.querySelectorAll(".product-card");
const shortcutButtons = document.querySelectorAll(".shortcut");
const quickLinks = document.querySelectorAll("[data-quick-filter]");
const petTabs = document.querySelectorAll(".pet-tab");
const resultCount = document.getElementById("result-count");
const cartButton = document.getElementById("cart-button");
const closeCartButton = document.getElementById("close-cart-button");
const cartDrawer = document.getElementById("cart-drawer");
const cartItems = document.getElementById("cart-items");
const cartEmpty = document.getElementById("cart-empty");
const cartCount = document.getElementById("cart-count");
const addCartButtons = document.querySelectorAll(".add-cart-button");
const profileButton = document.getElementById("profile-button");
const profileModal = document.getElementById("profile-modal");
const closeProfileButton = document.getElementById("close-profile-button");
const shopByPetButton = document.getElementById("shop-by-pet-button");
const buyAgainButton = document.getElementById("buy-again-button");

let activeCategory = "all";
let activePet = "all";
let cart = [];

function updateProducts() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    productCards.forEach(function (card) {
        const name = card.dataset.name;
        const category = card.dataset.category;
        const pet = card.dataset.pet;

        const matchesSearch = name.includes(searchTerm);
        const matchesCategory = activeCategory === "all" || category === activeCategory;
        const matchesPet = activePet === "all" || pet.includes(activePet);
        const shouldShow = matchesSearch && matchesCategory && matchesPet;

        card.classList.toggle("hidden", !shouldShow);

        if (shouldShow) {
            visibleCount += 1;
        }
    });

    resultCount.textContent = "Showing " + visibleCount + " services";
}

searchInput.addEventListener("input", updateProducts);

shortcutButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        activeCategory = button.dataset.category;

        shortcutButtons.forEach(function (shortcut) {
            shortcut.classList.remove("active-shortcut");
        });

        button.classList.add("active-shortcut");
        updateProducts();
    });
});

quickLinks.forEach(function (link) {
    link.addEventListener("click", function () {
        activeCategory = link.dataset.quickFilter;
        updateProducts();
    });
});

petTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
        activePet = tab.dataset.filter;

        petTabs.forEach(function (petTab) {
            petTab.classList.remove("active-tab");
        });

        tab.classList.add("active-tab");
        updateProducts();
    });
});

function renderCart() {
    cartItems.innerHTML = "";

    cart.forEach(function (item) {
        const cartItem = document.createElement("li");
        cartItem.textContent = item;
        cartItems.appendChild(cartItem);
    });

    cartCount.textContent = cart.length;
    cartEmpty.style.display = cart.length === 0 ? "block" : "none";
}

addCartButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        cart.push(button.dataset.product);
        renderCart();
        cartDrawer.classList.add("open");
    });
});

cartButton.addEventListener("click", function () {
    cartDrawer.classList.add("open");
});

closeCartButton.addEventListener("click", function () {
    cartDrawer.classList.remove("open");
});

profileButton.addEventListener("click", function () {
    profileModal.classList.add("open");
});

shopByPetButton.addEventListener("click", function () {
    profileModal.classList.add("open");
});

buyAgainButton.addEventListener("click", function () {
    cart.push("Repeat Plumbing Booking");
    renderCart();
    cartDrawer.classList.add("open");
});

closeProfileButton.addEventListener("click", function () {
    profileModal.classList.remove("open");
});

profileModal.addEventListener("click", function (event) {
    if (event.target === profileModal) {
        profileModal.classList.remove("open");
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        cartDrawer.classList.remove("open");
        profileModal.classList.remove("open");
    }
});

renderCart();
updateProducts();
