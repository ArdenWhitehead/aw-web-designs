// Select the hero buttons
const quoteButton = document.getElementById("quote-button");
const portfolioButton = document.getElementById("portfolio-button");
const contactButton = document.getElementById("contact-button");
const navPortfolioButton = document.getElementById("nav-portfolio-button");
const navContactButton = document.getElementById("nav-contact-button");
const footerQuoteButton = document.getElementById("footer-quote-button");
const footerContactButton = document.getElementById("footer-contact-button");
const packageButtons = document.querySelectorAll(".package-button");

// Select the modal windows
const quoteModal = document.getElementById("quote-modal");
const portfolioModal = document.getElementById("portfolio-modal");
const contactModal = document.getElementById("contact-modal");

// Select all close buttons and modals
const closeButtons = document.querySelectorAll(".close-button");
const allModals = document.querySelectorAll(".modal");

function openModal(modal) {
    if (!modal) return;

    modal.classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeModal(modal) {
    if (!modal) return;

    modal.classList.remove("open");
    document.body.style.overflow = "";
}

quoteButton.addEventListener("click", function () {
    openModal(quoteModal);
});

portfolioButton.addEventListener("click", function () {
    openModal(portfolioModal);
});

contactButton.addEventListener("click", function () {
    openModal(contactModal);
});

navPortfolioButton.addEventListener("click", function () {
    openModal(portfolioModal);
});

navContactButton.addEventListener("click", function () {
    openModal(contactModal);
});

footerQuoteButton.addEventListener("click", function () {
    openModal(quoteModal);
});

footerContactButton.addEventListener("click", function () {
    openModal(contactModal);
});

packageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const selectedPackage = button.dataset.package;
        const projectDetails = document.getElementById("project-details");

        projectDetails.value = "I am interested in the " + selectedPackage + ".";
        openModal(quoteModal);
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
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        allModals.forEach(function (modal) {
            closeModal(modal);
        });
    }
});

function showFormMessage(messageElement, message, messageType) {
    messageElement.className = "form-message";
    messageElement.textContent = message;
    messageElement.classList.add(messageType);
}

const quoteForm = document.getElementById("quote-form");
const quoteMessage = document.getElementById("quote-message");

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

const contactForm = document.getElementById("contact-form");
const contactMessageResult = document.getElementById("contact-message-result");

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

function showServiceMessage(serviceName) {
    document.getElementById("service-message").textContent =
        serviceName + ". Contact us to learn more about this service.";
}

const cards = document.querySelectorAll(".card");

cards.forEach(function (card) {
    card.addEventListener("click", function () {
        const serviceName = card.dataset.service;

        cards.forEach(c => c.classList.remove("active-card"));
        card.classList.add("active-card");

        showServiceMessage(serviceName);
    });
});
