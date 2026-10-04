(() => {
    "use strict";

    const clamp = value => Math.min(1, Math.max(0, value));
    const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
    const phase = (value, from, to) => smooth((value - from) / (to - from));
    function timeline(progress) {
        const p = clamp(progress);
        return {
            browser: phase(p, 0, 0.42),
            posts: phase(p, 0.12, 0.38),
            flight: phase(p, 0.22, 0.82),
            flightOpacity: phase(p, 0.2, 0.27) * (1 - phase(p, 0.81, 0.9)),
            targets: phase(p, 0.81, 0.9),
            sources: 1 - 0.5 * phase(p, 0.2, 0.32) * (1 - phase(p, 0.78, 0.96)),
            step: p < 0.2 ? 0 : p < 0.86 ? 1 : 2
        };
    }
    if (typeof module === "object" && module.exports) module.exports = { clamp, phase, timeline };
    if (typeof document === "undefined") return;

    const hero = document.getElementById("brand-hero");
    if (!hero) return;
    const canvas = hero.querySelector(".brand-canvas");
    const art = hero.querySelector(".brand-art");
    const browser = hero.querySelector(".design-browser");
    const sticky = hero.querySelector(".brand-sticky");
    const flightLayer = hero.querySelector(".brand-flight");
    const desktop = window.matchMedia("(min-width: 1101px) and (min-height: 780px)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const colours = {
        teal: { accent: "#24675f", tint: "#edf3ef", label: "Teal" },
        clay: { accent: "#934f3e", tint: "#f5eeea", label: "Clay" },
        ink: { accent: "#4e5875", tint: "#eef0f5", label: "Ink" }
    };
    const flights = ["image", "headline", "accent"].map(key => {
        const source = hero.querySelector('[data-source="' + key + '"]');
        const target = hero.querySelector('[data-target="' + key + '"]');
        const element = document.createElement("div");
        element.className = "flight-element flight-" + key;
        const clone = source.cloneNode(true);
        clone.removeAttribute("data-source");
        clone.removeAttribute("data-demo-headline");
        clone.removeAttribute("role");
        clone.removeAttribute("aria-label");
        element.append(clone);
        flightLayer.append(element);
        return { key, source, target, element, clone };
    });
    let frame = 0;
    let dirty = true;
    let lastProgress = -1;
    let scale = 1;
    let connected = false;
    const steps = [...hero.querySelectorAll("[data-story-step]")];
    const observer = "ResizeObserver" in window ? new ResizeObserver(() => schedule(true)) : null;

    function browserTransform(amount) {
        return "translateY(" + (-85 * amount).toFixed(3) + "px) scale(" + (1 - 0.16 * amount).toFixed(4) + ")";
    }
    function measure() {
        hero.classList.toggle("is-pinned", desktop.matches && !motion.matches);
        hero.classList.add("is-enhanced");
        scale = canvas.clientWidth / 800;
        hero.style.setProperty("--stage-scale", String(scale));
        for (const heading of hero.querySelectorAll("[data-demo-headline]")) {
            const maximum = heading.dataset.demoHeadline === "website" ? 29 : 24;
            heading.style.fontSize = maximum + "px";
            for (let size = maximum; heading.scrollHeight > heading.clientHeight + 1 && size > 14; size--) {
                heading.style.fontSize = (size - 1) + "px";
            }
        }
        const previous = browser.style.transform;
        const previousY = art.style.getPropertyValue("--posts-y");
        browser.style.transform = browserTransform(timeline(0.22).browser);
        art.style.setProperty("--posts-y", "0px");
        const origin = art.getBoundingClientRect();
        const box = node => {
            const rect = node.getBoundingClientRect();
            return { x: (rect.left - origin.left) / scale, y: (rect.top - origin.top) / scale, w: rect.width / scale, h: rect.height / scale };
        };
        // Cache source/target rectangles on resize or text changes, not every scroll.
        for (const flight of flights) {
            flight.from = box(flight.source);
            flight.to = box(flight.target);
            flight.element.style.width = flight.from.w + "px";
            flight.element.style.height = flight.from.h + "px";
            const font = getComputedStyle(flight.source);
            if (flight.key === "headline") {
                flight.clone.style.font = font.font;
                flight.clone.style.lineHeight = font.lineHeight;
            }
        }
        browser.style.transform = previous;
        art.style.setProperty("--posts-y", previousY || "0px");
        dirty = false;
        lastProgress = -1;
    }
    function render() {
        frame = 0;
        if (document.hidden) return;
        if (dirty) measure();
        const pinned = hero.classList.contains("is-pinned");
        const distance = Math.max(1, hero.offsetHeight - sticky.offsetHeight);
        const progress = pinned ? clamp((100 - hero.getBoundingClientRect().top) / distance) : 1;
        if (progress === lastProgress) return;
        lastProgress = progress;
        const state = timeline(progress);
        browser.style.transform = browserTransform(state.browser);
        art.style.setProperty("--posts-opacity", state.posts.toFixed(4));
        art.style.setProperty("--posts-y", (24 * (1 - state.posts)).toFixed(2) + "px");
        art.style.setProperty("--source-opacity", state.sources.toFixed(4));
        art.style.setProperty("--target-opacity", state.targets.toFixed(4));
        for (const flight of flights) {
            const t = state.flight;
            const x = flight.from.x + (flight.to.x - flight.from.x) * t;
            const y = flight.from.y + (flight.to.y - flight.from.y) * t - Math.sin(t * Math.PI) * 35;
            const sx = 1 + (flight.to.w / flight.from.w - 1) * t;
            const sy = 1 + (flight.to.h / flight.from.h - 1) * t;
            const turn = Math.sin(t * Math.PI) * (flight.key === "image" ? -3 : 2);
            flight.element.style.transform = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0) rotate(" + turn.toFixed(2) + "deg) scale(" + sx.toFixed(4) + "," + sy.toFixed(4) + ")";
            flight.element.style.opacity = state.flightOpacity.toFixed(4);
        }
        steps.forEach((step, index) => step.classList.toggle("is-current", index === state.step));
        hero.dataset.storyProgress = progress.toFixed(3);
    }
    function schedule(layout = false) {
        if (layout) dirty = true;
        if (!frame && !document.hidden) frame = requestAnimationFrame(render);
    }
    const onScroll = () => schedule();
    const onLayout = () => schedule(true);
    const onVisibility = () => {
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
        else schedule(true);
    };
    function connect() {
        if (connected) return;
        connected = true;
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onLayout, { passive: true });
        document.addEventListener("visibilitychange", onVisibility);
        desktop.addEventListener("change", onLayout);
        motion.addEventListener("change", onLayout);
        observer?.observe(canvas);
        schedule(true);
    }
    function disconnect() {
        connected = false;
        cancelAnimationFrame(frame);
        frame = 0;
        observer?.disconnect();
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onLayout);
        document.removeEventListener("visibilitychange", onVisibility);
        desktop.removeEventListener("change", onLayout);
        motion.removeEventListener("change", onLayout);
    }

    const colourButtons = [...hero.querySelectorAll("[data-demo-colour]")];
    const status = document.getElementById("demo-status");
    colourButtons.forEach(button => button.addEventListener("click", () => {
        const colour = colours[button.dataset.demoColour];
        hero.style.setProperty("--demo-accent", colour.accent);
        hero.style.setProperty("--demo-tint", colour.tint);
        colourButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        status.textContent = colour.label + " applied to the website and all three social designs.";
    }));
    const headline = document.getElementById("demo-headline");
    headline.addEventListener("input", () => {
        const text = headline.value.trim().slice(0, 40) || "Make room for something good.";
        hero.querySelectorAll("[data-demo-headline]").forEach(node => { node.textContent = text; });
        flights.find(flight => flight.key === "headline").clone.textContent = text;
        schedule(true);
    });
    headline.addEventListener("change", () => { status.textContent = "Sample headline updated. Nothing was saved or sent."; });
    window.addEventListener("pagehide", disconnect);
    window.addEventListener("pageshow", event => { if (event.persisted) connect(); });
    document.fonts?.ready.then(() => schedule(true));
    connect();
})();
