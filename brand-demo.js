(() => {
    "use strict";

    const clampProgress = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.5));
    function scrollProgress(rect, viewportHeight) {
        const height = Math.max(1, viewportHeight);
        return clampProgress((height - rect.top) / (height + Math.max(1, rect.height)));
    }
    function imageFrame(progress, compact = false, disabled = false) {
        if (disabled) return { scale: 1, y: 0 };
        const p = clampProgress(progress);
        const scale = 1 - 0.04 * (compact ? 0.35 : 1) * (1 - Math.sin(p * Math.PI));
        // Translation uses less than half the zoom inset, keeping the whole artwork in frame.
        return { scale, y: (1 - scale) * 40 * (1 - 2 * p) };
    }
    if (typeof module === "object" && module.exports) module.exports = { clampProgress, scrollProgress, imageFrame };
    if (typeof document === "undefined") return;

    const hero = document.getElementById("brand-hero");
    if (!hero) return;
    const stage = hero.querySelector(".brand-image-stage");
    const toggle = document.getElementById("brand-motion-toggle");
    const sample = hero.querySelector(".brand-example");
    const details = hero.querySelector(".brand-sample");
    const canvas = sample.querySelector(".brand-canvas");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 900px)");
    const state = { onScreen: false, userPaused: false };
    let connected = false;
    let frame = 0;
    let layoutDirty = true;
    let lastPose = "";
    const colours = {
        teal: { accent: "#24675f", tint: "#edf3ef", label: "Teal" },
        clay: { accent: "#934f3e", tint: "#f5eeea", label: "Clay" },
        ink: { accent: "#4e5875", tint: "#eef0f5", label: "Ink" }
    };

    function updateToggle() {
        toggle.hidden = motion.matches;
        const label = state.userPaused ? "Enable image movement" : "Pause image movement";
        toggle.setAttribute("aria-label", label);
        toggle.title = label;
        toggle.querySelector(".motion-play").hidden = !state.userPaused;
        toggle.querySelector(".motion-pause").hidden = state.userPaused;
    }
    function measureSample() {
        if (!details.open || !canvas.clientWidth) return;
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
    function render() {
        frame = 0;
        if (document.hidden) return;
        if (layoutDirty) { measureSample(); layoutDirty = false; }
        const disabled = motion.matches || state.userPaused;
        updateToggle();
        stage.classList.toggle("has-motion", state.onScreen && !disabled);
        if (!state.onScreen && !disabled) return;
        const pose = imageFrame(scrollProgress(stage.getBoundingClientRect(), window.innerHeight), compact.matches, disabled);
        const signature = pose.scale.toFixed(5) + ":" + pose.y.toFixed(4);
        if (signature === lastPose) return;
        lastPose = signature;
        stage.style.setProperty("--image-scale", pose.scale.toFixed(5));
        stage.style.setProperty("--image-y", pose.y.toFixed(4) + "%");
    }
    function schedule(layout = false) {
        if (layout) layoutDirty = true;
        if (!frame && connected && !document.hidden) frame = requestAnimationFrame(render);
    }
    function checkViewport() {
        const rect = stage.getBoundingClientRect();
        state.onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
    }
    const intersection = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
        state.onScreen = entries[0].isIntersecting;
        if (state.onScreen) schedule();
        else stage.classList.remove("has-motion");
    }, { threshold: 0 }) : null;
    const onLayout = () => { checkViewport(); schedule(true); };
    const resize = "ResizeObserver" in window ? new ResizeObserver(onLayout) : null;
    function onScroll() {
        if (!intersection) checkViewport();
        if (state.onScreen) schedule();
    }
    function onVisibility() {
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; stage.classList.remove("has-motion"); }
        else onLayout();
    }
    function connect() {
        if (connected) return;
        connected = true;
        motion.addEventListener("change", onLayout);
        compact.addEventListener("change", onLayout);
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onLayout, { passive: true });
        intersection?.observe(stage);
        resize?.observe(canvas);
        onLayout();
    }
    function disconnect() {
        connected = false;
        cancelAnimationFrame(frame);
        frame = 0;
        stage.classList.remove("has-motion");
        intersection?.disconnect();
        resize?.disconnect();
        motion.removeEventListener("change", onLayout);
        compact.removeEventListener("change", onLayout);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", onLayout);
        window.removeEventListener("scroll", onScroll);
    }
    toggle.addEventListener("click", () => { state.userPaused = !state.userPaused; schedule(); });

    const colourButtons = [...hero.querySelectorAll("[data-demo-colour]")];
    const status = document.getElementById("demo-status");
    colourButtons.forEach(button => button.addEventListener("click", () => {
        const colour = colours[button.dataset.demoColour];
        hero.style.setProperty("--demo-accent", colour.accent);
        hero.style.setProperty("--demo-tint", colour.tint);
        colourButtons.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        status.textContent = colour.label + " applied to the HTML sample only. The hero artwork is unchanged.";
    }));
    const headline = document.getElementById("demo-headline");
    headline.addEventListener("input", () => {
        const text = headline.value.trim().slice(0, 40) || "Make room for something good.";
        sample.querySelectorAll("[data-demo-headline]").forEach(node => { node.textContent = text; });
        schedule(true);
    });
    headline.addEventListener("change", () => { status.textContent = "HTML sample headline updated. Nothing was saved or sent. The hero artwork is unchanged."; });
    details.addEventListener("toggle", () => schedule(true));
    window.addEventListener("pagehide", disconnect);
    window.addEventListener("pageshow", event => { if (event.persisted) connect(); });
    document.fonts?.ready.then(onLayout);
    connect();
})();
