(() => {
    "use strict";
    const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
    function sequenceFrame(progress) {
        const p = ease(progress);
        return { laptopX: .35 * (1 - p), cards: [0, 1, 2].map(index => ease((progress - index * 0.09) / 0.8)) };
    }
    function scrollSequence(heroTop, headerHeight, viewportHeight) {
        return clamp((headerHeight - heroTop) / Math.max(160, Math.min(260, viewportHeight * 0.26)));
    }
    async function loadImage(src, ImageType) {
        const image = new ImageType();
        image.decoding = "async";
        image.src = src;
        await image.decode();
        if (!image.naturalWidth || !image.naturalHeight) throw new Error("The hero artwork has no decoded pixels.");
        // A responsive DOM image has layout dimensions, not reliable GPU texture dimensions.
        image.width = image.naturalWidth;
        image.height = image.naturalHeight;
        return image;
    }
    async function loadArtworkImage(artwork, ImageType) {
        await artwork.decode();
        return loadImage(artwork.currentSrc || artwork.src, ImageType);
    }
    // Visible regions in the user's 1600 x 900 artwork, ordered top-left clockwise.
    const artworkQuads = {
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
    function panelFrame(kind) {
        const uv = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => artworkUV(kind, u, v));
        const points = uv.map(point => ({ x: (point.u - .5) * 10, y: (point.v - .5) * 5.625 }));
        const centre = { x: points.reduce((sum, point) => sum + point.x, 0) / 4, y: points.reduce((sum, point) => sum + point.y, 0) / 4 };
        return { centre, uv, positions: points.map(point => [point.x - centre.x, point.y - centre.y, 0]) };
    }
    function sceneBounds(width, height) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new RangeError("A scene requires positive dimensions.");
        const top = Math.max(2.897, 5.15 * height / width), right = top * width / height;
        return { left: -right, right, top, bottom: -top };
    }
    function sceneQuality(width, height, displayDensity, isCompact) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new RangeError("A scene requires positive dimensions.");
        const density = Number.isFinite(displayDensity) && displayDensity > 0 ? displayDensity : 1;
        // Small Retina canvases stay sharp; a total-pixel budget bounds work on larger screens.
        const pixelRatio = Math.min(density, isCompact ? 3 : 2, (isCompact ? 1400 : 1800) / width, (isCompact ? 900 : 1100) / height, Math.sqrt((isCompact ? 900000 : 1500000) / (width * height)));
        return {
            pixelRatio,
            laptopSrc: !isCompact || pixelRatio > 1.5 ? "Images/aw-brand-scene-laptop.webp" : "Images/aw-brand-scene-laptop-small.webp"
        };
    }
    if (typeof module === "object" && module.exports) module.exports = { sequenceFrame, scrollSequence, artworkUV, loadArtworkImage, panelFrame, sceneBounds, sceneQuality };
    if (typeof document === "undefined") return;
    const hero = document.getElementById("brand-hero");
    const stage = document.getElementById("brand-scene-stage");
    const canvas = document.getElementById("brand-scene-canvas");
    const replay = document.getElementById("brand-scene-replay");
    const caption = document.getElementById("brand-scene-caption");
    if (!hero || !stage || !canvas || !replay) return;
    stage.classList.add("is-entered");
    // Local file origins cannot reliably upload photographic WebGL textures.
    if (window.location?.protocol === "file:") { fallback(); return; }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 900px)");
    const resources = new Set();
    const events = new AbortController();
    let renderer, scene, camera, composition, backdrop, laptop, shadow, cards, intersection, resize;
    let frame = 0, inView = true, disposed = false, failed = false, started = false, hasRendered = false;
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
            const { width, height } = stage.getBoundingClientRect();
            const quality = sceneQuality(width, height, window.devicePixelRatio, compact.matches);
            const [textureImage, laptopImage, backdropImage] = await Promise.all([
                loadArtworkImage(artwork, Image),
                loadImage(quality.laptopSrc, Image),
                loadImage("Images/aw-brand-scene-backdrop.jpg", Image)
            ]);
            if (disposed) return;
            renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            const gl = renderer.getContext();
            function texture(image) {
                const map = own(new THREE.Texture(image));
                map.colorSpace = THREE.SRGBColorSpace;
                map.generateMipmaps = false;
                map.minFilter = THREE.LinearFilter;
                map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
                map.needsUpdate = true;
                renderer.initTexture(map);
                if (gl.getError() !== gl.NO_ERROR) throw new Error("A photographic layer could not be uploaded to WebGL.");
                return map;
            }
            const artworkTexture = texture(textureImage);
            const laptopTexture = texture(laptopImage);
            const backdropTexture = texture(backdropImage);
            scene = new THREE.Scene();
            camera = new THREE.OrthographicCamera(-5.15, 5.15, 2.897, -2.897, .1, 40);
            camera.position.set(0, 0, 12); camera.lookAt(0, 0, 0);
            composition = new THREE.Group(); scene.add(composition);
            backdrop = new THREE.Mesh(own(new THREE.PlaneGeometry(10, 5.625)), own(new THREE.MeshBasicMaterial({ map: backdropTexture, depthWrite: false })));
            backdrop.position.z = -2; backdrop.renderOrder = -3; scene.add(backdrop);

            // Photo layers retain realistic lighting; limited depth motion avoids exposing nonexistent sides.
            const laptopGeometry = own(new THREE.PlaneGeometry(4.9, 4.9 * 861 / 1303));
            const laptopUV = laptopGeometry.attributes.uv;
            for (let index = 0; index < laptopUV.count; index++) {
                laptopUV.setXY(index, (169 + 1303 * laptopUV.getX(index)) / 1535, 1 - (968 - 861 * laptopUV.getY(index)) / 1024);
            }
            laptopUV.needsUpdate = true;
            laptop = new THREE.Mesh(laptopGeometry, own(new THREE.MeshBasicMaterial({ map: laptopTexture, transparent: true, alphaTest: .01, depthWrite: false, side: THREE.DoubleSide })));
            laptop.position.set(.025, .045, 1); laptop.renderOrder = 1; composition.add(laptop);
            cards = ["postOne", "postTwo", "postThree"].map(kind => {
                const layout = panelFrame(kind);
                const geometry = own(new THREE.BufferGeometry());
                geometry.setAttribute("position", new THREE.Float32BufferAttribute(layout.positions.flat(), 3));
                geometry.setAttribute("uv", new THREE.Float32BufferAttribute(layout.uv.flatMap(point => [point.u, point.v]), 2));
                geometry.setIndex([0, 3, 1, 1, 3, 2]);
                const face = new THREE.Mesh(geometry, own(new THREE.MeshBasicMaterial({ map: artworkTexture, side: THREE.DoubleSide, transparent: true, depthWrite: false })));
                face.renderOrder = 3; composition.add(face);
                const end = new THREE.Vector3(layout.centre.x, layout.centre.y - .4, .4);
                const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(.3, -.05, .4), new THREE.Vector3(2, -.1, .4), new THREE.Vector3(end.x - .6, end.y + .7, .4), end);
                const line = new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(curve.getPoints(32))), own(new THREE.LineBasicMaterial({ color: "#bb895d", transparent: true, opacity: .55, depthWrite: false })));
                line.renderOrder = 2; composition.add(line);
                return { face, line, layout };
            });
            const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = 128; shadowCanvas.height = 128;
            const ctx = shadowCanvas.getContext("2d");
            const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62); gradient.addColorStop(0, "rgba(43,32,22,.48)"); gradient.addColorStop(1, "rgba(43,32,22,0)");
            ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
            shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(4.6, .5)), own(new THREE.MeshBasicMaterial({ map: own(new THREE.CanvasTexture(shadowCanvas)), transparent: true, depthWrite: false })));
            shadow.position.set(.025, -2.04, -.5); shadow.renderOrder = -1; scene.add(shadow);
            resizeScene();
            resize = new ResizeObserver(resizeScene); resize.observe(stage);
            if (reduced.matches) { fallback(); return; }
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
        renderer.setPixelRatio(sceneQuality(width, height, window.devicePixelRatio, compact.matches).pixelRatio);
        renderer.setSize(width, height, false);
        Object.assign(camera, sceneBounds(width, height));
        camera.updateProjectionMatrix();
        backdrop.scale.set((camera.right - camera.left) / 10, (camera.top - camera.bottom) / 5.625, 1);
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
        composition.rotation.set(-currentY * .055, currentX * .065, 0);
        laptop.position.x = .025 + pose.laptopX; laptop.position.y = .045 - (1 - intro) * .16;
        laptop.rotation.set((1 - intro) * .04, 0, -(1 - intro) * .015);
        laptop.material.opacity = intro;
        shadow.position.x = laptop.position.x; shadow.material.opacity = intro;
        cards.forEach((card, index) => {
            const p = pose.cards[index], { x, y } = card.layout.centre;
            card.face.position.set(.2 + (x - .2) * p, .15 + (y - .15) * p, 1.25 + index * .12);
            card.face.scale.setScalar(.45 + .55 * p);
            card.face.rotation.set(currentY * .02, currentX * .025, [-.055, .04, -.03][index] * (1 - p));
            card.face.material.opacity = p; card.face.visible = p > .001;
            card.line.geometry.setDrawRange(0, Math.round(33 * p));
            card.line.visible = p > .01;
        });
        try {
            renderer.render(scene, camera);
            if (!hasRendered) {
                const gl = renderer.getContext();
                if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw new Error("The photographic scene could not render.");
                hasRendered = true;
                stage.classList.add("scene-ready");
                replay.hidden = false; caption.textContent = "Your brand in motion \u2014 layered photographic demonstration.";
            }
        } catch (error) {
            failed = true; dispose();
            console.info("The supplied artwork is being used because the optional 3D scene could not render.");
            return;
        }
        canvas.dataset.progress = progress.toFixed(3);
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
            if (hasRendered) {
                stage.classList.add("scene-ready"); replay.hidden = false;
                caption.textContent = "Your brand in motion \u2014 layered photographic demonstration.";
            }
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
