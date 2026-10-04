(() => {
    "use strict";
    document.documentElement.classList.add("js-enabled");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (window.lucide) window.lucide.createIcons();

    const nav = document.getElementById("main-nav");
    const menuButton = document.querySelector(".menu-toggle");
    function closeMenu() {
        nav?.classList.remove("is-open");
        menuButton?.setAttribute("aria-expanded", "false");
        menuButton?.setAttribute("aria-label", "Open navigation");
    }
    menuButton?.addEventListener("click", () => {
        const open = menuButton.getAttribute("aria-expanded") !== "true";
        nav.classList.toggle("is-open", open);
        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });
    nav?.addEventListener("click", event => {
        if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("click", event => {
        if (!event.target.closest(".site-header")) closeMenu();
    });
    window.matchMedia("(min-width: 801px)").addEventListener("change", closeMenu);

    let activeModal = null;
    let modalTrigger = null;
    const background = [...document.querySelectorAll("header, main, footer, .skip-link")];
    const previousInert = new Map();
    const focusSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
    function closeModal() {
        if (!activeModal) return;
        activeModal.hidden = true;
        activeModal.classList.remove("open");
        document.body.classList.remove("modal-open");
        for (const node of background) node.inert = previousInert.get(node) || false;
        previousInert.clear();
        activeModal = null;
        modalTrigger?.focus({ preventScroll: true });
    }
    function openModal(id, trigger) {
        const modal = document.getElementById(id);
        if (!modal) return;
        if (activeModal) closeModal();
        modalTrigger = trigger;
        activeModal = modal;
        for (const node of background) {
            previousInert.set(node, node.inert);
            node.inert = true;
        }
        modal.hidden = false;
        modal.classList.add("open");
        document.body.classList.add("modal-open");
        (modal.querySelector(focusSelector) || modal).focus({ preventScroll: true });
    }
    document.querySelectorAll("[data-open]").forEach(button => {
        button.addEventListener("click", event => {
            if (!document.getElementById(button.dataset.open)) return;
            event.preventDefault();
            openModal(button.dataset.open, button);
        });
    });
    document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeModal));
    document.querySelectorAll(".modal").forEach(modal => modal.addEventListener("click", event => {
        if (event.target === modal) closeModal();
    }));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeModal();
            closeMenu();
        }
        if (event.key === "Tab" && activeModal) {
            const targets = [...activeModal.querySelectorAll(focusSelector)].filter(node => node.getClientRects().length);
            const first = targets[0];
            const last = targets[targets.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    document.querySelectorAll(".package-button").forEach(button => {
        button.addEventListener("click", event => {
            if (!document.getElementById("quote-modal")) return;
            event.preventDefault();
            document.getElementById("project-details").value = "I am interested in the " + button.dataset.package + ".";
            openModal("quote-modal", button);
        });
    });
    const parameters = new URLSearchParams(window.location.search);
    const serviceSelect = document.getElementById("service");
    if (serviceSelect && [...serviceSelect.options].some(option => option.value === parameters.get("service"))) {
        serviceSelect.value = parameters.get("service");
    }
    const requestedPackage = parameters.get("package");
    if (["Starter Presence", "Custom Business Site", "Growth Website"].includes(requestedPackage)) {
        const details = document.getElementById("project-details");
        if (details && !details.value) details.value = "I am interested in the " + requestedPackage + ".";
    }

    document.querySelectorAll(".card[data-service]").forEach(card => {
        card.addEventListener("click", () => {
            const open = card.getAttribute("aria-expanded") !== "true";
            const panel = document.getElementById(card.getAttribute("aria-controls"));
            card.setAttribute("aria-expanded", String(open));
            panel.hidden = !open;
            card.classList.toggle("active-card", open);
            const message = document.getElementById("service-message");
            if (message) message.textContent = open ? card.dataset.service + " details expanded." : "";
        });
    });

    function showFormMessage(element, message, type) {
        element.className = "form-message " + type;
        element.textContent = message;
    }
    function connectForm(formId, resultId, quote = false) {
        const form = document.getElementById(formId);
        const result = document.getElementById(resultId);
        if (!form || !result) return;
        let submitting = false;
        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (submitting || !form.reportValidity()) return;
            const data = new FormData(form);
            const name = String(data.get("name") || "").trim();
            const email = String(data.get("email") || "").trim();
            const details = String(data.get(quote ? "projectDetails" : "message") || "").trim();
            if (name.length < 2 || details.length < 10) {
                showFormMessage(result, "Please enter your full name and at least 10 characters about your enquiry.", "error-message");
                return;
            }
            const message = quote ? [
                "Website and social design enquiry",
                "Business: " + (String(data.get("businessName") || "").trim() || "Not provided"),
                "Phone: " + (String(data.get("phone") || "").trim() || "Not provided"),
                "Service: " + form.querySelector("#service").selectedOptions[0].textContent,
                "Budget: " + (data.get("budget") ? form.querySelector("#budget").selectedOptions[0].textContent : "Not specified"),
                "",
                details
            ].join("\n") : details;
            if (message.length > 2000) {
                showFormMessage(result, "Please shorten your project details slightly and try again.", "error-message");
                return;
            }
            const button = form.querySelector('[type="submit"]');
            const original = button.innerHTML;
            submitting = true;
            button.disabled = true;
            button.textContent = "Sending...";
            form.setAttribute("aria-busy", "true");
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 20000);
            try {
                const response = await fetch(form.action, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, message }),
                    signal: controller.signal
                });
                const contentType = response.headers.get("content-type") || "";
                const payload = contentType.includes("application/json") ? await response.json() : {};
                if (!response.ok) throw new Error(payload.message || "The enquiry service is unavailable. Please email aw@gmail.com.au.");
                if (payload.preview) {
                    showFormMessage(result, "Preview only: your form is valid. No email was sent.", "success-message");
                } else {
                    showFormMessage(result, "Thank you, " + name + ". Your " + (quote ? "quote request" : "message") + " has been sent.", "success-message");
                    form.reset();
                }
            } catch (error) {
                showFormMessage(result, error.name === "AbortError" ? "The request timed out. Please try again or email aw@gmail.com.au." : error.message, "error-message");
            } finally {
                clearTimeout(timeout);
                submitting = false;
                button.disabled = false;
                button.innerHTML = original;
                form.removeAttribute("aria-busy");
            }
        });
    }
    connectForm("quote-form", "quote-message", true);
    connectForm("contact-form", "contact-message-result");

    document.querySelectorAll(".service-container, .difference-grid, .package-grid").forEach(group => {
        [...group.children].forEach((node, index) => {
            node.setAttribute("data-reveal", "");
            node.style.setProperty("--reveal-delay", Math.min(index, 2) * 55 + "ms");
        });
    });
    const revealNodes = [...document.querySelectorAll("[data-reveal]")];
    let observer;
    if ("IntersectionObserver" in window && !reducedMotion.matches) {
        observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add("is-visible");
                entry.target.classList.remove("reveal-pending");
                observer.unobserve(entry.target);
            }
        }, { threshold: 0.08 });
        for (const node of revealNodes) {
            if (node.closest(".modal")) continue;
            node.classList.add("reveal-pending");
            observer.observe(node);
            node.addEventListener("focusin", () => {
                node.classList.remove("reveal-pending");
                node.classList.add("is-visible");
                observer.unobserve(node);
            }, { once: true });
        }
        reducedMotion.addEventListener("change", event => {
            if (!event.matches) return;
            observer.disconnect();
            revealNodes.forEach(node => node.classList.remove("reveal-pending"));
        });
    }
    window.addEventListener("pageshow", event => {
        if (event.persisted) revealNodes.forEach(node => node.classList.remove("reveal-pending"));
    });
    window.addEventListener("pagehide", closeModal);
})();
