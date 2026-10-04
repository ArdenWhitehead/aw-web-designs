(() => {
    "use strict";
    const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
    function sequenceFrame(progress) {
        const p = ease(progress);
        return { laptopX: -0.25 - p * 1.3, cards: [0, 1, 2].map(index => ease((progress - index * 0.09) / 0.8)) };
    }
    function scrollSequence(heroTop, headerHeight, viewportHeight) {
        return clamp((headerHeight - heroTop) / Math.max(160, Math.min(260, viewportHeight * 0.26)));
    }
    if (typeof module === "object" && module.exports) module.exports = { sequenceFrame, scrollSequence };
    if (typeof document === "undefined") return;
    const hero = document.getElementById("brand-hero");
    const stage = document.getElementById("brand-scene-stage");
    const canvas = document.getElementById("brand-scene-canvas");
    const replay = document.getElementById("brand-scene-replay");
    const caption = document.getElementById("brand-scene-caption");
    if (!hero || !stage || !canvas || !replay) return;
    stage.classList.add("is-entered");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 900px)");
    const resources = new Set();
    const events = new AbortController();
    let renderer, scene, camera, laptop, lid, cards, intersection, resize;
    let frame = 0, inView = true, disposed = false, failed = false, started = false;
    let introStart = null, replayStart = null, heldProgress = null, progress = 0;
    let pointerX = 0, pointerY = 0, currentX = 0, currentY = 0;
    let themeStart = null, lastTextureDraw = 0, texturesDirty = true;
    let design = { accent: "#24675f", tint: "#edf3ef", headline: "Make room for something good." };
    let previousAccent = design.accent, previousTint = design.tint;
    const surfaces = [];
    const own = resource => { resources.add(resource); return resource; };
    function stop() { cancelAnimationFrame(frame); frame = 0; }
    function fallback() {
        stage.classList.remove("scene-ready"); replay.hidden = true;
        caption.textContent = "Website + social designs \u2014 illustrative brand concept.";
    }
    function dispose() {
        if (disposed) return;
        disposed = true; stop(); events.abort();
        intersection?.disconnect(); resize?.disconnect();
        resources.forEach(resource => resource.dispose()); resources.clear();
        renderer?.dispose(); fallback();
    }
    function schedule() {
        if (!frame && renderer && !disposed && !failed && !document.hidden && inView && !reduced.matches) frame = requestAnimationFrame(draw);
    }
    function mixHex(first, second, progress) {
        const a = parseInt(first.slice(1), 16), b = parseInt(second.slice(1), 16);
        return "#" + [16, 8, 0].map(shift => Math.round(((a >> shift) & 255) * (1 - progress) + ((b >> shift) & 255) * progress).toString(16).padStart(2, "0")).join("");
    }
    function wrap(ctx, text, x, y, width, size, maxLines = 3, colour = "#25322f") {
        ctx.fillStyle = colour;
        const value = String(text).slice(0, 80);
        for (let fontSize = size; fontSize >= 14; fontSize--) {
            ctx.font = "500 " + fontSize + "px 'DM Sans', sans-serif";
            const lines = []; let line = "";
            for (const word of value.split(/\s+/)) {
                if (ctx.measureText(word).width > width) {
                    if (line) { lines.push(line); line = ""; }
                    for (const character of word) {
                        if (line && ctx.measureText(line + character).width > width) { lines.push(line); line = ""; }
                        line += character;
                    }
                    continue;
                }
                const candidate = line ? line + " " + word : word;
                if (line && ctx.measureText(candidate).width > width) { lines.push(line); line = word; }
                else line = candidate;
            }
            if (line) lines.push(line.trim());
            if (lines.length > maxLines && fontSize > 14) continue;
            lines.slice(0, maxLines).forEach((part, index) => ctx.fillText(part, x, y + index * fontSize * 1.15));
            return;
        }
    }
    function mark(ctx, x, y, colour, scale = 1) {
        ctx.fillStyle = colour;
        ctx.fillRect(x, y + 10 * scale, 5 * scale, 16 * scale);
        ctx.fillRect(x + 9 * scale, y, 5 * scale, 26 * scale);
        ctx.fillRect(x + 18 * scale, y + 6 * scale, 5 * scale, 20 * scale);
    }
    // Original studio artwork is drawn locally; no client images or testimonials are fetched.
    function studio(ctx, x, y, width, height, accent, tint) {
        ctx.save(); ctx.translate(x, y); ctx.scale(width / 360, height / 270);
        ctx.fillStyle = tint; ctx.fillRect(0, 0, 360, 270);
        ctx.fillStyle = "#d9ded5"; ctx.fillRect(0, 222, 360, 48);
        ctx.fillStyle = "#fafaf7";
        ctx.beginPath(); ctx.moveTo(38, 222); ctx.lineTo(38, 95); ctx.arc(106, 95, 68, Math.PI, 0); ctx.lineTo(174, 222); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(106, 28); ctx.lineTo(106, 222); ctx.moveTo(38, 125); ctx.lineTo(174, 125); ctx.stroke();
        ctx.fillStyle = "#d5b774"; ctx.beginPath(); ctx.arc(141, 86, 17, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#37453e"; ctx.lineWidth = 4;
        for (const shelf of [104, 160]) { ctx.beginPath(); ctx.moveTo(210, shelf); ctx.lineTo(327, shelf); ctx.stroke(); }
        ctx.fillStyle = accent;
        [[219, 73, 13, 30], [240, 66, 10, 37], [260, 83, 18, 20], [227, 133, 26, 26]].forEach(rect => ctx.fillRect(...rect));
        ctx.fillStyle = "#d5b774"; ctx.beginPath(); ctx.ellipse(302, 94, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fafaf7"; ctx.fillRect(281, 133, 30, 26);
        ctx.strokeStyle = "#37453e"; ctx.beginPath(); ctx.moveTo(117, 207); ctx.lineTo(111, 257); ctx.moveTo(219, 207); ctx.lineTo(225, 257); ctx.stroke();
        ctx.fillStyle = "#fafaf7"; ctx.beginPath(); ctx.ellipse(170, 207, 69, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = accent; ctx.fillRect(163, 174, 17, 25);
        for (const [px, py, scale] of [[171, 157, 1], [299, 190, 1.3]]) {
            ctx.strokeStyle = accent; ctx.beginPath(); ctx.moveTo(px, py + 20); ctx.lineTo(px, py - 18); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(px - 10 * scale, py - 8, 7 * scale, 17 * scale, -.65, 0, Math.PI * 2); ctx.ellipse(px + 10 * scale, py - 20, 7 * scale, 17 * scale, .65, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#fafaf7"; ctx.fillRect(284, 209, 31, 38); ctx.strokeRect(284, 209, 31, 38);
        ctx.restore();
    }
    function paint(surface, accent, tint) {
        const { ctx, canvas: image, kind, texture } = surface;
        ctx.clearRect(0, 0, image.width, image.height);
        ctx.fillStyle = kind === "tip" ? accent : kind === "testimonial" ? tint : "#fafaf7";
        ctx.fillRect(0, 0, image.width, image.height);
        const ink = kind === "tip" ? "#ffffff" : accent;
        if (kind === "website") {
            ctx.fillStyle = "#e8ece6"; ctx.fillRect(0, 0, image.width, 32);
            ctx.fillStyle = "#93a59a";
            [20, 36, 52].forEach(x => { ctx.beginPath(); ctx.arc(x, 16, 4, 0, Math.PI * 2); ctx.fill(); });
            ctx.font = "14px 'DM Sans', sans-serif"; ctx.fillText("examplestudio.example", 406, 21);
            mark(ctx, 45, 53, accent, 1.4);
            ctx.font = "600 26px 'DM Sans', sans-serif"; ctx.fillStyle = accent; ctx.fillText("Example Studio", 91, 80);
            ctx.font = "18px 'DM Sans', sans-serif"; ctx.fillStyle = "#57645d"; ctx.fillText("Studio     Objects     Visit", 713, 77);
            ctx.font = "17px 'DM Sans', sans-serif"; ctx.fillStyle = accent; ctx.fillText("A LITTLE LOCAL INSPIRATION", 46, 143);
            wrap(ctx, design.headline, 46, 210, 396, 52, 3);
            ctx.font = "19px 'DM Sans', sans-serif"; ctx.fillStyle = "#57645d"; ctx.fillText("Thoughtful objects. Creative moments.", 46, 379);
            ctx.fillStyle = accent; ctx.fillRect(46, 409, 190, 43);
            ctx.font = "18px 'DM Sans', sans-serif"; ctx.fillStyle = "#ffffff"; ctx.fillText("Enquire with us  \u2197", 60, 437);
            studio(ctx, 496, 122, 482, 348, accent, tint);
            ctx.fillStyle = "#d8e0d7"; ctx.fillRect(46, 499, 932, 2);
            ctx.font = "600 20px 'DM Sans', sans-serif"; ctx.fillStyle = "#25322f";
            ctx.fillText("Everyday objects", 46, 538); ctx.fillText("Creative moments", 520, 538);
            ctx.font = "16px 'DM Sans', sans-serif"; ctx.fillStyle = "#57645d";
            ctx.fillText("Considered pieces for your space.", 46, 566); ctx.fillText("Make something yours.", 520, 566);
            ctx.font = "13px 'DM Sans', sans-serif"; ctx.fillText("DEMONSTRATION ONLY", 46, 608);
        } else {
            mark(ctx, 34, 30, ink);
            ctx.font = "600 22px 'DM Sans', sans-serif"; ctx.fillStyle = ink; ctx.fillText("Example Studio", 73, 52);
            ctx.font = "14px 'DM Sans', sans-serif";
            ctx.fillText(kind === "promotion" ? "NEW AT THE STUDIO" : kind === "tip" ? "A SMALL DESIGN TIP" : "SAMPLE TESTIMONIAL", 34, 105);
            if (kind === "promotion") {
                wrap(ctx, design.headline, 34, 162, 444, 43, 3);
                studio(ctx, 34, 320, 444, 248, accent, tint);
                ctx.font = "17px 'DM Sans', sans-serif"; ctx.fillStyle = accent; ctx.fillText("Find your next little inspiration.  \u2197", 34, 602);
            } else if (kind === "tip") {
                wrap(ctx, "Give your message room to breathe.", 34, 174, 426, 47, 4, "#ffffff");
                ctx.font = "24px 'DM Sans', sans-serif"; ctx.fillStyle = "#ffffff";
                ["One clear idea.", "A little white space.", "A stronger first impression."].forEach((line, index) => ctx.fillText(line, 34, 426 + index * 40));
                mark(ctx, 396, 561, "#ffffff", 2);
            } else {
                mark(ctx, 34, 149, accent, 2.5);
                wrap(ctx, "Your customer's words could appear here.", 34, 298, 426, 44, 4);
                ctx.font = "19px 'DM Sans', sans-serif"; ctx.fillStyle = "#57645d";
                ctx.fillText("Placeholder only.", 34, 570); ctx.fillText("Not a customer review.", 34, 602);
            }
        }
        texture.needsUpdate = true;
    }
    async function start() {
        if (started || disposed || failed || reduced.matches) return;
        started = true;
        try {
            // Reuses the pinned, free Three.js release already used by this project.
            const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
            if (disposed) return;
            renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !compact.matches, powerPreference: "low-power" });
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            scene = new THREE.Scene();
            camera = new THREE.OrthographicCamera(-5, 5, 3.5, -3.5, .1, 40);
            camera.position.set(0, 4.4, 12); camera.lookAt(0, .9, 0);
            scene.add(new THREE.HemisphereLight("#ffffff", "#b6c7bb", 2.2));
            const light = new THREE.DirectionalLight("#fff6e7", 2.8); light.position.set(-3, 8, 7); scene.add(light);
            const dark = own(new THREE.MeshStandardMaterial({ color: "#222b29", roughness: .46, metalness: .35 }));
            const metal = own(new THREE.MeshStandardMaterial({ color: "#aab6af", roughness: .4, metalness: .65 }));
            const white = own(new THREE.MeshStandardMaterial({ color: "#fafaf7", roughness: .7 }));
            const keyMaterial = own(new THREE.MeshStandardMaterial({ color: "#26332f", roughness: .7 }));
            function box(width, height, depth, material, parent, x, y, z) {
                const mesh = new THREE.Mesh(own(new THREE.BoxGeometry(width, height, depth)), material);
                mesh.position.set(x, y, z); parent.add(mesh); return mesh;
            }
            function surface(kind, width, height, parent, x, y, z) {
                const image = document.createElement("canvas"); image.width = kind === "website" ? 1024 : 512; image.height = 640;
                const texture = own(new THREE.CanvasTexture(image)); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
                const material = own(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }));
                const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(width, height)), material);
                mesh.position.set(x, y, z); parent.add(mesh);
                surfaces.push({ canvas: image, ctx: image.getContext("2d"), kind, texture }); return mesh;
            }
            laptop = new THREE.Group(); laptop.position.y = -.65; scene.add(laptop);
            box(5.5, .13, 3.05, metal, laptop, 0, 0, 0);
            box(5.25, .025, 2.85, metal, laptop, 0, .077, 0);
            box(1.5, .012, .7, dark, laptop, 0, .096, .9);
            const keyGeometry = own(new THREE.BoxGeometry(.29, .028, .25));
            const keys = own(new THREE.InstancedMesh(keyGeometry, keyMaterial, 65));
            const matrix = new THREE.Matrix4();
            for (let row = 0; row < 5; row++) for (let column = 0; column < 13; column++) {
                matrix.makeTranslation((column - 6) * .35, .107, -1.02 + row * .31); keys.setMatrixAt(row * 13 + column, matrix);
            }
            laptop.add(keys);
            lid = new THREE.Group(); lid.position.set(0, .09, -1.46); laptop.add(lid);
            box(5.5, 3.55, .115, dark, lid, 0, 1.77, 0);
            surface("website", 5.16, 3.225, lid, 0, 1.77, .061);
            box(.04, .04, .008, metal, lid, 0, 3.46, .063);
            cards = ["promotion", "tip", "testimonial"].map(kind => {
                const group = new THREE.Group(); scene.add(group);
                const bodyMaterial = white.clone(); own(bodyMaterial); bodyMaterial.transparent = true;
                const body = box(1.87, 2.35, .055, bodyMaterial, group, 0, 0, 0);
                const face = surface(kind, 1.79, 2.24, group, 0, 0, .03);
                return { group, body, face };
            });
            const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = 128; shadowCanvas.height = 128;
            const ctx = shadowCanvas.getContext("2d");
            const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62); gradient.addColorStop(0, "rgba(36,54,43,.25)"); gradient.addColorStop(1, "rgba(36,54,43,0)");
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
            const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(8, 5)), own(new THREE.MeshBasicMaterial({ map: own(new THREE.CanvasTexture(shadowCanvas)), transparent: true, depthWrite: false })));
            shadow.rotation.x = -Math.PI / 2; shadow.position.set(-1.2, -.85, .1); scene.add(shadow);
            const styles = getComputedStyle(hero);
            design.accent = styles.getPropertyValue("--demo-accent").trim() || design.accent;
            design.tint = styles.getPropertyValue("--demo-tint").trim() || design.tint;
            design.headline = document.getElementById("demo-headline").value.trim().slice(0, 40) || design.headline;
            surfaces.forEach(item => paint(item, design.accent, design.tint));
            resizeScene();
            resize = new ResizeObserver(resizeScene); resize.observe(stage);
            if (reduced.matches) { fallback(); return; }
            stage.classList.add("scene-ready", "is-entered");
            replay.hidden = false; caption.textContent = "Example Studio \u2014 original 3D design demonstration.";
            schedule();
        } catch (error) {
            failed = true; dispose();
            console.info("The supplied artwork is being used instead of the optional 3D demonstration.");
        }
    }
    function resizeScene() {
        if (!renderer || disposed) return;
        const { width, height } = stage.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, compact.matches ? 1 : 1.5, 1800 / width, 1100 / height));
        renderer.setSize(width, height, false);
        const halfHeight = compact.matches ? 3.75 : 3.45;
        camera.left = -halfHeight * width / height; camera.right = -camera.left;
        camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
        schedule();
    }
    function draw(now) {
        frame = 0;
        if (disposed || failed || document.hidden || !inView || reduced.matches) return;
        if (introStart === null) introStart = now;
        const intro = ease((now - introStart) / 950);
        const header = document.querySelector(".site-header").getBoundingClientRect().height;
        const scroll = scrollSequence(hero.getBoundingClientRect().top, header, innerHeight);
        let target = heldProgress ?? (compact.matches ? intro : scroll);
        if (replayStart !== null) {
            target = ease((now - replayStart) / 1900);
            if (now - replayStart >= 1900) { replayStart = null; heldProgress = 1; }
        }
        progress += (target - progress) * .12;
        if (Math.abs(target - progress) < .001) progress = target;
        currentX += (pointerX - currentX) * .09; currentY += (pointerY - currentY) * .09;
        const pose = sequenceFrame(progress);
        laptop.position.x = pose.laptopX; laptop.position.y = -.65 - (1 - intro) * .3;
        laptop.rotation.set(.01 + currentY * .035, -.12 + currentX * .12, -.015);
        lid.rotation.x = -.13 + (1 - intro) * .45;
        const finalPositions = [[1.05, 2.45, .25], [3.05, .9, .65], [1.45, -.65, 1.5]];
        cards.forEach((card, index) => {
            const p = pose.cards[index]; const [x, y, z] = finalPositions[index];
            card.group.position.set(-.1 + (x + .1) * p, 1.35 + (y - 1.35) * p, -1.1 + (z + 1.1) * p);
            card.group.scale.setScalar(.3 + .7 * p);
            card.group.rotation.set(currentY * .025, [-.2, -.13, .12][index] * p + currentX * .09, [-.065, .055, -.04][index] * p);
            card.face.material.opacity = p; card.body.material.opacity = p; card.group.visible = p > .001;
        });
        const themeProgress = themeStart === null ? 1 : ease((now - themeStart) / 240);
        if (texturesDirty || (themeStart !== null && now - lastTextureDraw > 30) || themeProgress === 1 && themeStart !== null) {
            surfaces.forEach(item => paint(item, mixHex(previousAccent, design.accent, themeProgress), mixHex(previousTint, design.tint, themeProgress)));
            texturesDirty = false; lastTextureDraw = now;
            if (themeProgress === 1) themeStart = null;
        }
        renderer.render(scene, camera); canvas.dataset.progress = progress.toFixed(3);
        if (intro < 1 || replayStart !== null || themeStart !== null || Math.abs(target - progress) > .001 || Math.abs(currentX - pointerX) > .001 || Math.abs(currentY - pointerY) > .001) schedule();
    }
    const signal = events.signal;
    window.addEventListener("scroll", () => { heldProgress = null; replayStart = null; schedule(); }, { passive: true, signal });
    window.addEventListener("resize", resizeScene, { passive: true, signal });
    hero.addEventListener("pointermove", event => {
        if (compact.matches || event.pointerType === "touch" || reduced.matches) return;
        const rect = stage.getBoundingClientRect();
        pointerX = Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5));
        pointerY = Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / rect.height - .5)); schedule();
    }, { passive: true, signal });
    hero.addEventListener("pointerleave", () => { pointerX = pointerY = 0; schedule(); }, { signal });
    hero.addEventListener("branddesignchange", event => {
        previousAccent = design.accent; previousTint = design.tint;
        design = { accent: event.detail.accent, tint: event.detail.tint, headline: String(event.detail.headline).slice(0, 40) };
        themeStart = performance.now(); texturesDirty = true; schedule();
    }, { signal });
    replay.addEventListener("click", () => { replayStart = performance.now(); heldProgress = null; progress = 0; schedule(); }, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else schedule(); }, { signal });
    reduced.addEventListener("change", () => {
        stop();
        if (reduced.matches) fallback();
        else if (renderer && !failed) {
            stage.classList.add("scene-ready"); replay.hidden = false;
            caption.textContent = "Example Studio \u2014 original 3D design demonstration.";
            heldProgress = 1; resizeScene();
        } else start();
    }, { signal });
    compact.addEventListener("change", () => { pointerX = pointerY = 0; resizeScene(); }, { signal });
    canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); failed = true; dispose(); }, { signal });
    window.addEventListener("pagehide", event => { stop(); if (!event.persisted) dispose(); }, { signal });
    window.addEventListener("pageshow", event => { if (event.persisted) { resizeScene(); schedule(); } }, { signal });
    document.fonts?.ready.then(() => { if (!disposed) { texturesDirty = true; schedule(); } });
    if ("IntersectionObserver" in window) {
        intersection = new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            if (inView) { start(); schedule(); } else stop();
        }, { rootMargin: "100px" });
        intersection.observe(stage);
    } else start();
    if (reduced.matches) fallback();
})();
