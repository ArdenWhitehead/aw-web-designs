(() => {
    "use strict";
    const hero = document.getElementById("brand-hero");
    if (!hero) return;
    const sample = hero.querySelector(".brand-example");
    const details = hero.querySelector(".brand-sample");
    const canvas = sample.querySelector(".brand-canvas");
    const colours = {
        teal: { accent: "#24675f", tint: "#edf3ef", label: "Teal" },
        clay: { accent: "#934f3e", tint: "#f5eeea", label: "Clay" },
        ink: { accent: "#4e5875", tint: "#eef0f5", label: "Ink" }
    };
    const buttons = [...hero.querySelectorAll("[data-demo-colour]")];
    const headline = document.getElementById("demo-headline");
    const status = document.getElementById("demo-status");
    let colourName = "teal";
    let frame = 0;
    function measure() {
        frame = 0;
        if (document.hidden || !details.open || !canvas.clientWidth) return;
        sample.classList.add("is-enhanced");
        sample.style.setProperty("--stage-scale", String(canvas.clientWidth / 800));
        for (const heading of sample.querySelectorAll("[data-demo-headline]")) {
            const maximum = heading.dataset.demoHeadline === "website" ? 29 : 24;
            heading.style.fontSize = maximum + "px";
            for (let size = maximum; heading.scrollHeight > heading.clientHeight + 1 && size > 14; size--) {
                heading.style.fontSize = (size - 1) + "px";
            }
        }
    }
    function schedule() {
        if (!frame && !document.hidden) frame = requestAnimationFrame(measure);
    }
    function announceDesign() {
        hero.dispatchEvent(new CustomEvent("branddesignchange", {
            detail: { ...colours[colourName], headline: headline.value.trim().slice(0, 40) || "Make room for something good." }
        }));
    }
    buttons.forEach(button => button.addEventListener("click", () => {
        if (!colours[button.dataset.demoColour]) return;
        colourName = button.dataset.demoColour;
        const colour = colours[colourName];
        hero.style.setProperty("--demo-accent", colour.accent);
        hero.style.setProperty("--demo-tint", colour.tint);
        buttons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        status.textContent = colour.label + " applied to the Example Studio demonstration. The fallback photograph is unchanged.";
        announceDesign();
    }));
    headline.addEventListener("input", () => {
        const text = headline.value.trim().slice(0, 40) || "Make room for something good.";
        sample.querySelectorAll("[data-demo-headline]").forEach(node => { node.textContent = text; });
        announceDesign(); schedule();
    });
    headline.addEventListener("change", () => {
        status.textContent = "Example Studio headline updated. Nothing was saved or sent. The fallback photograph is unchanged.";
    });
    details.addEventListener("toggle", schedule);
    const resize = "ResizeObserver" in window ? new ResizeObserver(schedule) : null;
    resize?.observe(canvas);
    window.addEventListener("resize", schedule, { passive: true });
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("pagehide", () => { cancelAnimationFrame(frame); frame = 0; resize?.disconnect(); });
    window.addEventListener("pageshow", event => {
        if (event.persisted) { resize?.observe(canvas); schedule(); }
    });
    document.fonts?.ready.then(schedule);
    schedule();
})();
