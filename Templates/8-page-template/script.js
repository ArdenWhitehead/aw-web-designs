const quoteButton = document.getElementById("quote-button");
const portfolioButton = document.getElementById("portfolio-button");
const contactButton = document.getElementById("contact-button");
const navPortfolioButton = document.getElementById("nav-portfolio-button");
const navContactButton = document.getElementById("nav-contact-button");
const footerQuoteButton = document.getElementById("footer-quote-button");
const footerContactButton = document.getElementById("footer-contact-button");
const packageButtons = document.querySelectorAll(".package-button");

const quoteModal = document.getElementById("quote-modal");
const portfolioModal = document.getElementById("portfolio-modal");
const contactModal = document.getElementById("contact-modal");

const closeButtons = document.querySelectorAll(".close-button");
const allModals = document.querySelectorAll(".modal");
let lastFocusedElement = null;

const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
].join(",");

function addClickHandler(element, handler) {
    if (!element) return;

    element.addEventListener("click", handler);
}

function getFocusableElements(modal) {
    return Array.from(modal.querySelectorAll(focusableSelector));
}

function openModal(modal) {
    if (!modal) return;

    lastFocusedElement = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const focusableElements = getFocusableElements(modal);
    const firstFocusableElement = focusableElements[0];

    if (firstFocusableElement) {
        firstFocusableElement.focus();
    }
}

function closeModal(modal, shouldRestoreFocus = true) {
    if (!modal || !modal.classList.contains("open")) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (shouldRestoreFocus && lastFocusedElement) {
        lastFocusedElement.focus();
    }
}

function closeAllModals() {
    allModals.forEach(function (modal) {
        closeModal(modal, false);
    });

    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
}

allModals.forEach(function (modal) {
    modal.setAttribute("aria-hidden", "true");
});

addClickHandler(quoteButton, function () {
    openModal(quoteModal);
});

addClickHandler(portfolioButton, function () {
    openModal(portfolioModal);
});

addClickHandler(contactButton, function () {
    openModal(contactModal);
});

addClickHandler(navPortfolioButton, function () {
    openModal(portfolioModal);
});

addClickHandler(navContactButton, function () {
    openModal(contactModal);
});

addClickHandler(footerQuoteButton, function () {
    openModal(quoteModal);
});

addClickHandler(footerContactButton, function () {
    openModal(contactModal);
});

packageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const selectedPackage = button.dataset.package;
        const projectDetails = document.getElementById("project-details");

        if (projectDetails && quoteModal) {
            projectDetails.value = "I am interested in the " + selectedPackage + ".";
            openModal(quoteModal);
            return;
        }

        window.location.href = "contact.html";
    });
});

closeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const modalId = button.dataset.close;
        const modal = document.getElementById(modalId);

        closeModal(modal);
    });
});

allModals.forEach(function (modal) {
    modal.addEventListener("click", function (event) {
        if (event.target === modal) {
            closeModal(modal);
        }
    });

    modal.addEventListener("keydown", function (event) {
        if (event.key !== "Tab") return;

        const focusableElements = getFocusableElements(modal);
        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements[focusableElements.length - 1];

        if (!firstFocusableElement || !lastFocusableElement) return;

        if (event.shiftKey && document.activeElement === firstFocusableElement) {
            event.preventDefault();
            lastFocusableElement.focus();
        }

        if (!event.shiftKey && document.activeElement === lastFocusableElement) {
            event.preventDefault();
            firstFocusableElement.focus();
        }
    });
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeAllModals();
    }
});

function showFormMessage(messageElement, message, messageType) {
    if (!messageElement) return;

    messageElement.className = "form-message";
    messageElement.textContent = message;
    messageElement.classList.add(messageType);
}

const quoteForm = document.getElementById("quote-form");
const quoteMessage = document.getElementById("quote-message");

if (quoteForm) {
    quoteForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = document.getElementById("quote-name").value.trim();
        const email = document.getElementById("quote-email").value.trim();
        const service = document.getElementById("service").value;
        const details = document.getElementById("project-details").value.trim();

        if (name.length < 2) {
            showFormMessage(quoteMessage, "Please enter your full name.", "error-message");
            return;
        }

        if (!email.includes("@")) {
            showFormMessage(quoteMessage, "Please enter a valid email address.", "error-message");
            return;
        }

        if (service === "") {
            showFormMessage(quoteMessage, "Please select a service.", "error-message");
            return;
        }

        if (details.length < 10) {
            showFormMessage(
                quoteMessage,
                "Please provide more information about your project.",
                "error-message"
            );
            return;
        }

        showFormMessage(
            quoteMessage,
            `Thank you, ${name}. Your quote request has been received.`,
            "success-message"
        );

        quoteForm.reset();
    });
}

const contactForm = document.getElementById("contact-form");
const contactMessageResult = document.getElementById("contact-message-result");

if (contactForm) {
    contactForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = document.getElementById("contact-name").value.trim();
        const email = document.getElementById("contact-email").value.trim();
        const message = document.getElementById("contact-message").value.trim();

        if (name.length < 2) {
            showFormMessage(contactMessageResult, "Please enter your full name.", "error-message");
            return;
        }

        if (!email.includes("@")) {
            showFormMessage(contactMessageResult, "Please enter a valid email address.", "error-message");
            return;
        }

        if (message.length < 10) {
            showFormMessage(
                contactMessageResult,
                "Please enter a more detailed message.",
                "error-message"
            );
            return;
        }

        showFormMessage(
            contactMessageResult,
            `Thank you, ${name}. Your message has been sent.`,
            "success-message"
        );

        contactForm.reset();
    });
}

function showServiceMessage(serviceName) {
    const serviceMessage = document.getElementById("service-message");

    if (!serviceMessage) return;

    serviceMessage.textContent = serviceName + ". Contact us to learn more about this service.";
}

const cards = document.querySelectorAll(".card");

cards.forEach(function (card) {
    card.addEventListener("click", function () {
        const serviceName = card.dataset.service;

        cards.forEach(function (item) {
            item.classList.remove("active-card");
        });

        card.classList.add("active-card");
        showServiceMessage(serviceName);
    });
});
