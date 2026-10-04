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
    // Visible regions in the user's 1600 x 900 artwork, ordered top-left clockwise.
    const artworkQuads = {
        website: [[430, 232], [835, 201], [869, 557], [478, 609]],
        postOne: [[906, 110], [1099, 65], [1084, 394], [877, 435]],
        postTwo: [[1134, 198], [1350, 158], [1319, 446], [1103, 465]],
        postThree: [[1367, 338], [1582, 360], [1538, 626], [1320, 597]]
    };
    function artworkUV(kind, u, v) {
        const quad = artworkQuads[kind];
        if (!quad) throw new RangeError("Unknown artwork surface");
        const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
        const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
        const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
        const determinant = dx1 * dy2 - dx2 * dy1;
        const g = (dx3 * dy2 - dx2 * dy3) / determinant;
        const h = (dx1 * dy3 - dx3 * dy1) / determinant;
        const denominator = g * u + h * v + 1;
        const x = ((x1 - x0 + g * x1) * u + (x3 - x0 + h * x3) * v + x0) / denominator;
        const y = ((y1 - y0 + g * y1) * u + (y3 - y0 + h * y3) * v + y0) / denominator;
        return { u: x / 1600, v: 1 - y / 900 };
    }
    if (typeof module === "object" && module.exports) module.exports = { sequenceFrame, scrollSequence, artworkUV };
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
    async function start() {
        if (started || disposed || failed || reduced.matches) return;
        started = true;
        try {
            // Reuses the pinned, free Three.js release already used by this project.
            const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
            const artwork = hero.querySelector(".brand-hero-image");
            await artwork.decode();
            if (disposed) return;
            const artworkTexture = own(new THREE.Texture(artwork));
            artworkTexture.colorSpace = THREE.SRGBColorSpace;
            artworkTexture.needsUpdate = true;
            renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !compact.matches, powerPreference: "low-power" });
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            scene = new THREE.Scene();
            camera = new THREE.OrthographicCamera(-5, 5, 3.5, -3.5, .1, 40);
            camera.position.set(0, 4.4, 12); camera.lookAt(0, .9, 0);
            scene.add(new THREE.HemisphereLight("#ffffff", "#b6c7bb", 2.2));
            const light = new THREE.DirectionalLight("#fff6e7", 2.8); light.position.set(-3, 8, 7); scene.add(light);
            const dark = own(new THREE.MeshStandardMaterial({ color: "#222b29", roughness: .46, metalness: .35 }));
            const metal = own(new THREE.MeshStandardMaterial({ color: "#b6b0a7", roughness: .4, metalness: .65 }));
            const white = own(new THREE.MeshStandardMaterial({ color: "#fafaf7", roughness: .7 }));
            const keyMaterial = own(new THREE.MeshStandardMaterial({ color: "#26332f", roughness: .7 }));
            function box(width, height, depth, material, parent, x, y, z) {
                const mesh = new THREE.Mesh(own(new THREE.BoxGeometry(width, height, depth)), material);
                mesh.position.set(x, y, z); parent.add(mesh); return mesh;
            }
            artworkTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
            function surface(kind, width, height, parent, x, y, z) {
                // Projective UVs flatten the photographed panels without modifying the source image.
                const segments = compact.matches ? 8 : 24;
                const geometry = own(new THREE.PlaneGeometry(width, height, segments, segments));
                const uv = geometry.attributes.uv;
                for (let index = 0; index < uv.count; index++) {
                    const point = artworkUV(kind, uv.getX(index), 1 - uv.getY(index));
                    uv.setXY(index, point.u, point.v);
                }
                uv.needsUpdate = true;
                const material = own(new THREE.MeshBasicMaterial({ map: artworkTexture, side: THREE.DoubleSide, transparent: true }));
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(x, y, z); parent.add(mesh);
                return mesh;
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
            cards = ["postOne", "postTwo", "postThree"].map(kind => {
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
            resizeScene();
            resize = new ResizeObserver(resizeScene); resize.observe(stage);
            if (reduced.matches) { fallback(); return; }
            stage.classList.add("scene-ready", "is-entered");
            replay.hidden = false; caption.textContent = "Supplied brand artwork \u2014 interactive 3D demonstration.";
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
        renderer.render(scene, camera); canvas.dataset.progress = progress.toFixed(3);
        if (intro < 1 || replayStart !== null || Math.abs(target - progress) > .001 || Math.abs(currentX - pointerX) > .001 || Math.abs(currentY - pointerY) > .001) schedule();
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
    replay.addEventListener("click", () => { replayStart = performance.now(); heldProgress = null; progress = 0; schedule(); }, { signal });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else schedule(); }, { signal });
    reduced.addEventListener("change", () => {
        stop();
        if (reduced.matches) fallback();
        else if (renderer && !failed) {
            stage.classList.add("scene-ready"); replay.hidden = false;
            caption.textContent = "Supplied brand artwork \u2014 interactive 3D demonstration.";
            heldProgress = 1; resizeScene();
        } else start();
    }, { signal });
    compact.addEventListener("change", () => { pointerX = pointerY = 0; resizeScene(); }, { signal });
    canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); failed = true; dispose(); }, { signal });
    window.addEventListener("pagehide", event => { stop(); if (!event.persisted) dispose(); }, { signal });
    window.addEventListener("pageshow", event => { if (event.persisted) { resizeScene(); schedule(); } }, { signal });
    if ("IntersectionObserver" in window) {
        intersection = new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            if (inView) { start(); schedule(); } else stop();
        }, { rootMargin: "100px" });
        intersection.observe(stage);
    } else start();
    if (reduced.matches) fallback();
})();
