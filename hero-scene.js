const mount = document.getElementById("hero-scene");
const canvas = document.getElementById("terrain-canvas");
const pauseButton = document.getElementById("scene-toggle");
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
const compact = window.matchMedia("(max-width: 800px)");
let disposed = false;
let renderer;
let frame = 0;
let events;
let intersection;
let sizes;
const geometries = [];
const materials = [];
function cleanup() {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    events?.abort();
    intersection?.disconnect();
    sizes?.disconnect();
    geometries.forEach(item => item.dispose());
    materials.forEach(item => item.dispose());
    renderer?.dispose();
    mount?.classList.remove("scene-ready");
    if (pauseButton) pauseButton.hidden = true;
}
window.addEventListener("pagehide", event => {
    if (!event.persisted) cleanup();
});

async function startTerrain() {
    if (!mount || !canvas) return;
    try {
        const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
        if (disposed) return;
        const mobile = compact.matches;
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: !mobile,
            powerPreference: "low-power"
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog("#111818", 15, 36);
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
        const terrain = new THREE.Group();
        terrain.position.set(3.5, -1.8, -3);
        scene.add(terrain);

        // One shared height field keeps the surface and its contours together.
        function height(x, z) {
            return 1.4 * Math.sin(x * 0.23 + z * 0.32) +
                0.85 * Math.cos(x * 0.39 - z * 0.18) +
                0.35 * Math.sin(z * 0.75 + x * 0.12);
        }
        const segmentsX = mobile ? 64 : 120;
        const segmentsZ = mobile ? 48 : 84;
        const geometry = new THREE.PlaneGeometry(30, 24, segmentsX, segmentsZ);
        geometries.push(geometry);
        geometry.rotateX(-Math.PI / 2);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            positions.setY(i, height(positions.getX(i), positions.getZ(i)));
        }
        geometry.computeVertexNormals();
        const surface = new THREE.MeshStandardMaterial({
            color: "#28483e", roughness: 0.6, metalness: 0.55,
            side: THREE.DoubleSide
        });
        materials.push(surface);
        terrain.add(new THREE.Mesh(geometry, surface));
        const regularLines = [];
        const accentLines = [];
        const lineCount = mobile ? 32 : 64;
        const lineSamples = mobile ? 70 : 130;
        for (let row = 0; row <= lineCount; row++) {
            const z = -12 + row / lineCount * 24;
            const buffer = row % 8 === 0 ? accentLines : regularLines;
            for (let step = 0; step < lineSamples; step++) {
                for (const offset of [0, 1]) {
                    const x = -15 + (step + offset) / lineSamples * 30;
                    buffer.push(x, height(x, z) + 0.022, z);
                }
            }
        }
        for (const [buffer, color, opacity] of [[regularLines, "#a7b9a1", 0.24], [accentLines, "#d9bd75", 0.68]]) {
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(buffer, 3));
            const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
            terrain.add(new THREE.LineSegments(lineGeometry, material));
            materials.push(material);
            geometries.push(lineGeometry);
        }
        scene.add(new THREE.HemisphereLight("#c0d4c5", "#0b1817", 1.3));
        const warmLight = new THREE.DirectionalLight("#f3ddad", 3.0);
        warmLight.position.set(8, 9, -2);
        scene.add(warmLight);
        const coolLight = new THREE.DirectionalLight("#82b7a5", 2);
        coolLight.position.set(-6, 4, 6);
        scene.add(coolLight);
        const hero = mount.closest(".hero");
        events = new AbortController();
        let inView = true;
        let paused = false;
        let lastDraw = 0;
        let time = 0;
        let lastTime = 0;
        const pointer = { x: 0, y: 0 };
        const easedPointer = { x: 0, y: 0 };

        function resize() {
            const { width, height: elementHeight } = mount.getBoundingClientRect();
            if (!width || !elementHeight || disposed) return;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact.matches ? 1.25 : 1.5, 1600 / width, 1100 / elementHeight));
            renderer.setSize(width, elementHeight, false);
            camera.aspect = width / elementHeight;
            camera.position.set(compact.matches ? 1 : 2.0, compact.matches ? 8.5 : 6, compact.matches ? 19 : 15);
            camera.lookAt(compact.matches ? 2 : 1, -1, -4);
            camera.updateProjectionMatrix();
            renderer.render(scene, camera);
        }
        function canAnimate() {
            return !disposed && !document.hidden && inView && !paused && !motion.matches;
        }
        function draw(now) {
            frame = 0;
            if (!canAnimate()) return;
            frame = requestAnimationFrame(draw);
            const interval = compact.matches ? 1000 / 30 : 1000 / 45;
            if (now - lastDraw < interval) return;
            time += lastTime ? Math.min((now - lastTime) / 1000, 0.06) : 0;
            lastTime = now;
            lastDraw = now;
            easedPointer.x += (pointer.x - easedPointer.x) * 0.025;
            easedPointer.y += (pointer.y - easedPointer.y) * 0.025;
            terrain.rotation.y = Math.sin(time * 0.10) * 0.035 + easedPointer.x * 0.035;
            terrain.rotation.z = easedPointer.y * 0.012;
            terrain.position.y = -1.8 + Math.sin(time * 0.3) * 0.09;
            renderer.render(scene, camera);
        }
        function syncAnimation() {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            lastTime = 0;
            if (canAnimate()) frame = requestAnimationFrame(draw);
            else if (!disposed && !document.hidden) renderer.render(scene, camera);
        }
        hero.addEventListener("pointermove", event => {
            if (compact.matches || motion.matches) return;
            const bounds = hero.getBoundingClientRect();
            pointer.x = (event.clientX - bounds.left) / bounds.width - 0.5;
            pointer.y = (event.clientY - bounds.top) / bounds.height - 0.5;
        }, { passive: true, signal: events.signal });
        hero.addEventListener("pointerleave", () => { pointer.x = 0; pointer.y = 0; }, { signal: events.signal });
        document.addEventListener("visibilitychange", syncAnimation, { signal: events.signal });
        motion.addEventListener("change", () => {
            pauseButton.hidden = motion.matches;
            syncAnimation();
        }, { signal: events.signal });
        pauseButton.addEventListener("click", () => {
            paused = !paused;
            pauseButton.setAttribute("aria-pressed", String(paused));
            const label = paused ? "Resume background animation" : "Pause background animation";
            pauseButton.setAttribute("aria-label", label);
            pauseButton.title = label;
            pauseButton.innerHTML = '<i data-lucide="' + (paused ? "play" : "pause") + '" aria-hidden="true"></i>';
            window.lucide?.createIcons();
            syncAnimation();
        }, { signal: events.signal });
        intersection = new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            syncAnimation();
        });
        intersection.observe(hero);
        sizes = new ResizeObserver(resize);
        sizes.observe(mount);
        window.addEventListener("pagehide", () => {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
        }, { signal: events.signal });
        window.addEventListener("pageshow", syncAnimation, { signal: events.signal });
        canvas.addEventListener("webglcontextlost", event => {
            event.preventDefault();
            cleanup();
        }, { signal: events.signal });
        resize();
        mount.classList.add("scene-ready");
        pauseButton.hidden = motion.matches;
        syncAnimation();
    } catch (error) {
        cleanup();
        mount.classList.remove("scene-ready");
        console.info("The static terrain is being used.");
    }
}
startTerrain();
