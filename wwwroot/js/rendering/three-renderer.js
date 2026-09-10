import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { place, projectCamera } from './coordinates.js';
import { createCombatEffects } from './combat-effects.js';
import { ProjectileTrailState } from './projectile-trails.js';
import { createAtmosphere } from './atmosphere.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { AdaptiveQuality } from './adaptive-quality.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const ROCK_VARIANTS = 10;
// Rugged mineral rock tints: silvery basalt, warm ochre, icy pale, deep slate.
const ROCK_MATERIAL_COLORS = ['#8d97a8', '#9c8168', '#a9b6c4', '#5f6674'];
// Mirrors canvas-renderer.js POWERUP_COLORS so the same glyph/color identifies a pickup in either renderer.
const POWERUP_STYLES = [
    { fill: '#5ce8ff', glow: '#2ab8ff', label: 'S' },
    { fill: '#ffb347', glow: '#ff6a00', label: 'R' },
    { fill: '#d98cff', glow: '#b44dff', label: 'T' }
];

// A crisp canvas-drawn letter glyph, used as a texture on a camera-facing plane so each pickup
// reads as its power-up type (Shield/RapidFire/TripleShot) instead of an unlabeled shape.
function createLabelTexture(letter) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 10;
    ctx.fillText(letter, size / 2, size / 2 + 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// Deterministic per-seed generator; never touches Math.random or the C# gameplay stream.
function seededRandom(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}

// Continuous object-space noise keeps relief coherent across triangle and UV seams.
function rockNoise(x, y, z, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fade = t => t * t * (3 - 2 * t);
    const tx = fade(x - ix), ty = fade(y - iy), tz = fade(z - iz);
    const hash = (a, b, c) => {
        let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647) ^ seed;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };
    let value = 0;
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        value += hash(ix + dx, iy + dy, iz + dz)
            * (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz);
    }
    return value;
}

// Broad broken outlines, intermediate ridges and fine rubble relief share a stable seed.
function buildRockGeometry(seed, sizeClass) {
    const geometry = new THREE.IcosahedronGeometry(1, sizeClass === 0 ? 9 : 24);
    const position = geometry.attributes.position;
    const rand = seededRandom(seed + 1);
    // An anisotropic base stretch breaks the "ball" silhouette before any bumps are applied,
    // giving each rock its own oblong/potato-like proportions like a real asteroid. The range is
    // deliberately wide so some rocks stay chunky while others are noticeably elongated.
    const axisStretch = new THREE.Vector3(0.6 + rand() * 0.75, 0.6 + rand() * 0.75, 0.6 + rand() * 0.75);
    // A varying number of broad low-frequency lobes (some outward, some inward) sculpt a
    // non-convex, irregular outline rather than a smooth bump riding on an otherwise spherical body.
    const lobes = Array.from({ length: 5 + Math.floor(rand() * 5) }, () => ({
        dir: new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize(),
        amount: (rand() < 0.35 ? -1 : 1) * (0.14 + rand() * 0.38),
        // Sharpness kept >= 2 so `align ** sharpness` has zero slope where `align` clamps to 0,
        // avoiding a visible crease/seam ring at each lobe's boundary (a hard kink would show up
        // as a faint crack line even with smooth vertex normals).
        sharpness: 2 + rand() * 2.5
    }));
    // Keep a few broad impacts distinct from the surrounding fractured surface.
    const craterCount = sizeClass === 0 ? 0 : (sizeClass === 1 ? 2 : 4) + (seed % 2);
    const phase = rand() * Math.PI * 2;
    const craters = Array.from({ length: craterCount }, (_, idx) => {
        const z = 1 - 2 * (idx + 0.5) / craterCount;
        const angle = phase + idx * Math.PI * (3 - Math.sqrt(5));
        const radial = Math.sqrt(1 - z * z);
        const direction = new THREE.Vector3(Math.cos(angle) * radial, Math.sin(angle) * radial, z);
        const majorAxis = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0)
            .applyAxisAngle(direction, rand() * Math.PI);
        const radius = sizeClass === 2 ? 0.34 + rand() * 0.30 : 0.26 + rand() * 0.26;
        return {
            dir: direction,
            majorAxis,
            aspect: 1 + rand() * 0.30,
            radius,
            depth: radius * (0.34 + rand() * 0.18)
        };
    });
    const colors = new Float32Array(position.count * 3);
    const warm = new THREE.Color(ROCK_MATERIAL_COLORS[seed % ROCK_MATERIAL_COLORS.length]);
    // Shadowed crater floors read as cool/dark; sunlit ridges get a lighter, slightly warmer tint
    // (mirrors the dusty tan highlights vs. deep blue-grey shadow seen on real asteroids).
    const shadow = warm.clone().multiply(new THREE.Color('#3d4666')).multiplyScalar(0.55);
    const highlight = warm.clone().lerp(new THREE.Color('#e8d9b8'), 0.55);
    const vertex = new THREE.Vector3();
    const dir = new THREE.Vector3();
    let maxPlanar = 0;
    const displaced = [];
    const dents = new Float32Array(position.count);
    const mineral = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);
        vertex.multiply(axisStretch);
        dir.copy(vertex).normalize();
        let bump = 0;
        for (const lobe of lobes) {
            const align = Math.max(0, dir.dot(lobe.dir));
            bump += align ** lobe.sharpness * lobe.amount;
        }
        let dent = 0;
        let bowlMask = 0;
        for (const crater of craters) {
            // Chord distance keeps bowl and rim in the same units. The compact profile
            // ends at the rim instead of raising a broad halo across the entire asteroid.
            const alongMajor = dir.dot(crater.majorAxis);
            const distance = Math.sqrt(Math.max(0, 2 * (1 - dir.dot(crater.dir))
                + alongMajor * alongMajor * (1 / (crater.aspect * crater.aspect) - 1)));
            // Low-frequency variation breaks up otherwise perfectly circular rims.
            const rimVariation = 1 + (rockNoise(dir.x * 5 + 3, dir.y * 5 + 11, dir.z * 5 + 17, seed) - 0.5) * 0.24;
            const t = distance / (crater.radius * rimVariation);
            if (t < 1) {
                const bowl = (1 - t * t) ** 2;
                dent += crater.depth * bowl;
                bowlMask = Math.max(bowlMask, bowl);
            }
            if (t > 0.72 && t < 1.28) {
                dent -= crater.depth * 0.22 * Math.sin(Math.PI * (t - 0.72) / 0.56) ** 2;
            }
        }
        dents[i] = dent;
        const noise = frequency => rockNoise(dir.x * frequency + 13, dir.y * frequency + 7, dir.z * frequency + 19, seed);
        const coarse = noise(3.8) - 0.5;
        const rubble = noise(12) - 0.5;
        const grit = noise(29) - 0.5;
        // Absolute noise forms angular ridge networks rather than rounded sinusoidal bumps.
        const ridge = 0.5 - Math.abs(noise(7) * 2 - 1);
        // Smooth bowl interiors so rubble relief does not obscure the impact shape.
        const relief = (coarse * 0.24 + ridge * 0.09 + rubble * 0.055 + grit * 0.02)
            * (1 - bowlMask * 0.85);
        mineral[i] = (coarse * 0.35 + rubble * 0.65 + grit * 0.3) * (1 - bowlMask * 0.75);
        const scale = 1 + bump - dent + relief;
        displaced.push(vertex.clone().multiplyScalar(Math.max(0.3, scale)));
        maxPlanar = Math.max(maxPlanar, Math.hypot(displaced[i].x, displaced[i].y));
    }
    for (let i = 0; i < position.count; i++) {
        const dent = dents[i];
        // Crater floors (positive dent) darken toward the cool shadow tone; raised ridges/rims
        // (negative dent) lighten toward the warm highlight tone.
        const tone = dent >= 0
            ? warm.clone().lerp(shadow, Math.min(0.8, dent * 5))
            : warm.clone().lerp(highlight, Math.min(0.6, -dent * 7));
        tone.multiplyScalar(0.78 + mineral[i] * 0.85);
        colors[i * 3] = tone.r; colors[i * 3 + 1] = tone.g; colors[i * 3 + 2] = tone.b;
    }
    // Normalize so the top-down silhouette matches the existing collision radius exactly.
    const norm = 1 / (maxPlanar || 1);
    for (let i = 0; i < position.count; i++) {
        const v = displaced[i].multiplyScalar(norm);
        position.setXYZ(i, v.x, v.y, v.z * 0.85);
    }
    position.needsUpdate = true;
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Smooth, interpolated normals across the displaced surface (rather than per-face flat
    // normals) so lighting reads as a rounded rock instead of a faceted low-poly gem.
    // IcosahedronGeometry is non-indexed: computing normals directly leaves every
    // triangle flat. Weld positions for normals, then restore the original UV layout.
    const weldedSource = geometry.clone();
    weldedSource.deleteAttribute('uv');
    weldedSource.deleteAttribute('normal');
    const welded = mergeVertices(weldedSource);
    welded.computeVertexNormals();
    const smooth = welded.toNonIndexed();
    geometry.setAttribute('normal', smooth.getAttribute('normal').clone());
    weldedSource.dispose();
    welded.dispose();
    smooth.dispose();
    geometry.computeBoundingSphere();
    return geometry;
}

// Sample a spherical 3D mineral field into the UV map: no repeated checkerboard or
// heavily blurred grain. Several scales retain both gravel and fine regolith detail.
function createBumpTexture(seed) {
    const width = 512, height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
        const latitude = y / (height - 1) * Math.PI;
        for (let x = 0; x < width; x++) {
            const longitude = x / (width - 1) * Math.PI * 2;
            const nx = Math.sin(latitude) * Math.cos(longitude);
            const ny = Math.cos(latitude);
            const nz = Math.sin(latitude) * Math.sin(longitude);
            const noise = f => rockNoise(nx * f + 13, ny * f + 7, nz * f + 19, seed);
            const value = 0.45 * noise(22) + 0.35 * noise(55) + 0.20 * noise(120);
            const i = (y * width + x) * 4;
            image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(value * 255);
            image.data[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
}

// A small library of asteroid meshes/materials selected by each asteroid's stable visual seed,
// so identical rocks always look identical and a given rock never changes appearance mid-flight.
function buildRockLibrary(own) {
    const geometries = Array.from({ length: 3 }, (_, sizeClass) =>
        Array.from({ length: ROCK_VARIANTS }, (_, i) => own(buildRockGeometry(i * 97 + 11, sizeClass))));
    const materials = ROCK_MATERIAL_COLORS.map((color, i) => own(new THREE.MeshStandardMaterial({
        color: '#b9afa0', vertexColors: true, roughness: 1, metalness: 0, flatShading: false,
        envMapIntensity: 0.15,
        bumpMap: own(createBumpTexture(i * 61 + 5)), bumpScale: 2.8
    })));
    // A fixed, seed-derived body tilt gives each rock its own tumble axis instead of spinning flat.
    const tiltFor = seed => {
        const rand = seededRandom(seed + 500);
        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            (rand() - 0.5) * 0.7, (rand() - 0.5) * 0.7, 0));
        return tilt;
    };
    return {
        geometryFor: (seed, radius) => geometries[radius <= 15 ? 0 : radius <= 25 ? 1 : 2][Math.abs(seed) % ROCK_VARIANTS],
        materialFor: seed => materials[Math.abs(seed >> 8) % materials.length],
        tiltFor
    };
}

// Builds the detailed player ship: beveled metal hull, layered wings, glass cockpit,
// emissive engine nozzle/flame, and blinking navigation lights. Returns { ship, flame, navLights }.
function buildShip(own) {
    const ship = new THREE.Group();

    const hullShape = new THREE.Shape();
    hullShape.moveTo(21, 0);
    hullShape.lineTo(-6, -9);
    hullShape.lineTo(-13, -12);
    hullShape.lineTo(-9, -3);
    hullShape.lineTo(-9, 3);
    hullShape.lineTo(-13, 12);
    hullShape.lineTo(-6, 9);
    hullShape.closePath();
    const hullGeometry = own(new THREE.ExtrudeGeometry(hullShape, {
        depth: 5, bevelEnabled: true, bevelThickness: 1.1, bevelSize: 1, bevelSegments: 2, steps: 1
    }));
    hullGeometry.center();
    hullGeometry.translate(2, 0, 0);
    const hull = new THREE.Mesh(hullGeometry, own(new THREE.MeshStandardMaterial({
        color: '#c3d3dc', metalness: 0.55, roughness: 0.35
    })));
    ship.add(hull);

    // Dark recessed underside, slightly inset and lower, reads as shadowed structure beneath the hull.
    const underGeometry = own(new THREE.ExtrudeGeometry(hullShape, { depth: 2, bevelEnabled: false, steps: 1 }));
    underGeometry.center();
    underGeometry.translate(2, 0, -2.2);
    const underside = new THREE.Mesh(underGeometry, own(new THREE.MeshStandardMaterial({
        color: '#12181f', metalness: 0.2, roughness: 0.85
    })));
    underside.scale.set(0.92, 0.8, 1);
    ship.add(underside);

    // Layered wings: two angled silver blades trailing from the hull.
    const wingGeometry = own(new THREE.BoxGeometry(16, 3.4, 1.1));
    const wingMaterial = own(new THREE.MeshStandardMaterial({ color: '#8fa4b4', metalness: 0.5, roughness: 0.4 }));
    for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(wingGeometry, wingMaterial);
        wing.position.set(-6, side * 10, 0.5);
        wing.rotation.z = side * 0.32;
        ship.add(wing);
    }

    // Glass-like cockpit canopy toward the nose.
    const cockpit = new THREE.Mesh(
        own(new THREE.SphereGeometry(4.4, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        own(new THREE.MeshPhysicalMaterial({
            color: '#bff2ff', emissive: '#0d3a4a', emissiveIntensity: 0.25,
            metalness: 0, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.82
        }))
    );
    cockpit.position.set(9, 0, 3.4);
    cockpit.rotation.x = Math.PI / 2;
    ship.add(cockpit);

    // Dark metal engine housing plus the emissive flame cone (visible only while thrusting).
    const nozzle = new THREE.Mesh(
        own(new THREE.CylinderGeometry(5, 6, 6, 16)),
        own(new THREE.MeshStandardMaterial({ color: '#232b34', metalness: 0.6, roughness: 0.5 }))
    );
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.x = -14;
    ship.add(nozzle);
    const flame = new THREE.Mesh(
        own(new THREE.ConeGeometry(4, 22, 10)),
        own(new THREE.MeshBasicMaterial({ color: '#4bcfff', transparent: true,
            opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }))
    );
    flame.rotation.z = Math.PI / 2;
    flame.position.x = -24;
    const core = new THREE.Mesh(flame.geometry, own(new THREE.MeshBasicMaterial({ color: '#d4faff' })));
    core.scale.set(0.45, 0.65, 0.45);
    flame.add(core);
    ship.add(flame);

    // Blinking navigation lights at the wingtips (red port, green starboard, aviation convention).
    const navLights = [-1, 1].map(side => {
        const light = new THREE.Mesh(
            own(new THREE.SphereGeometry(1.1, 8, 8)),
            own(new THREE.MeshBasicMaterial({ color: side < 0 ? '#ff4b4b' : '#5cff88', transparent: true }))
        );
        light.position.set(-13, side * 12.6, 0.6);
        ship.add(light);
        return light;
    });

    return { ship, flame, navLights };
}

export function createThreeRenderer() {
    let renderer, scene, camera, elapsed = 0;
    let prevYaw = null, rollAngle = 0;
    const owned = new Set();
    const pools = new Map();
    const own = resource => { owned.add(resource); return resource; };
    let shipRig, flame, navLights, shield, rockLibrary, laserGeometry, laserMaterial;
    let pickupOrbGeometry, pickupRingGeometry, pickupLabelGeometry;
    let pickupOrbMaterials, pickupRingMaterials, pickupLabelMaterials;
    let particleGeometry, pmremTexture;
    let combat, trailGeometry, trailMaterial, laserGlowMaterial;
    const traceState = new ProjectileTrailState();
    let traceGeometry;
    let atmosphere, composer, bloom, renderPass, vignette, outputPass;
    let graphics = { quality: 'auto', reducedEffects: false };
    let lowQuality = false;
    let lastSize, adaptive;
    let traceMesh, starMesh;
    const instanceDummy = new THREE.Object3D();
    const traceColor = new THREE.Color();
    const applyQuality = () => {
        if (!lastSize) return;
        lowQuality = graphics.quality === 'low' || (graphics.quality === 'auto' && adaptive.low);
        const ratio = Math.min(lastSize.pixelRatio, lowQuality ? 1 : 2);
        renderer.setPixelRatio(ratio);
        renderer.setSize(lastSize.width, lastSize.height, false);
        composer.setPixelRatio(ratio);
        composer.setSize(lastSize.width, lastSize.height);
        // Bloom runs at half the main backing resolution in High mode.
        bloom.setSize(Math.max(1, lastSize.width * ratio * 0.5), Math.max(1, lastSize.height * ratio * 0.5));
        bloom.enabled = !lowQuality && !graphics.reducedEffects;
    };
    const particleMaterials = new Map();
    const materialFor = color => {
        if (!particleMaterials.has(color)) particleMaterials.set(color, own(new THREE.MeshBasicMaterial({ color })));
        return particleMaterials.get(color);
    };
    // Index-keyed pools reuse transient slots (lasers, pickups, stars, particles have no stable ID).
    // Rocks are keyed by their persistent entity ID so a given asteroid keeps its mesh across frames.
    const pool = (name, items, make, update, keyFn) => {
        let map = pools.get(name);
        if (!map) { map = new Map(); pools.set(name, map); }
        const seen = new Set();
        items.forEach((item, i) => {
            const key = keyFn ? keyFn(item, i) : i;
            seen.add(key);
            let object = map.get(key);
            if (!object) { object = make(item); scene.add(object); map.set(key, object); }
            object.visible = true;
            update(object, item);
        });
        for (const [key, object] of map) {
            if (seen.has(key)) continue;
            if (keyFn) { scene.remove(object); map.delete(key); }
            else object.visible = false;
        }
    };
    return {
        kind: 'webgl',
        async init(canvas) {
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
            renderer.setClearColor('#050b19');
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.1;
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            scene = new THREE.Scene();
            camera = new THREE.OrthographicCamera(0, 1100, 0, -800, 0.1, 2000);
            camera.position.z = 1000;
            atmosphere = createAtmosphere(scene, own);
            composer = new EffectComposer(renderer);
            renderPass = new RenderPass(scene, camera);
            bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.3, 1.5);
            vignette = new ShaderPass(VignetteShader);
            vignette.uniforms.offset.value = 0.65;
            vignette.uniforms.darkness.value = 1;
            outputPass = new OutputPass();
            for (const pass of [renderPass, bloom, vignette, outputPass]) composer.addPass(pass);

            scene.add(new THREE.AmbientLight('#4f5d78', 0.55));
            const key = new THREE.DirectionalLight('#f3f8ff', 2.1);
            key.position.set(-300, 500, 600);
            scene.add(key);
            const fill = new THREE.DirectionalLight('#5b7ea8', 0.6);
            fill.position.set(400, -350, 300);
            scene.add(fill);
            // A baked room environment lets metal hulls/rocks reflect differently from bare shading.
            const pmrem = new THREE.PMREMGenerator(renderer);
            const roomEnvironment = new RoomEnvironment();
            pmremTexture = own(pmrem.fromScene(roomEnvironment, 0.04)).texture;
            scene.environment = pmremTexture;
            pmrem.dispose();
            roomEnvironment.dispose();

            ({ ship: shipRig, flame, navLights } = buildShip(own));
            scene.add(shipRig);

            shield = new THREE.Mesh(own(new THREE.SphereGeometry(24, 32, 20)), own(new THREE.ShaderMaterial({
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
                vertexShader: `varying vec3 normalView;
                    void main() { normalView = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                fragmentShader: `varying vec3 normalView;
                    void main() { float edge = pow(1.0 - abs(normalize(normalView).z), 2.0);
                    gl_FragColor = vec4(0.25, 0.8, 1.0, 0.035 + edge * 0.65); }`
            })));
            scene.add(shield);
            combat = createCombatEffects(scene, own);

            rockLibrary = buildRockLibrary(own);

            laserGeometry = own(new THREE.BoxGeometry(14, 3.5, 2));
            laserMaterial = materialFor('#e5fcff');
            laserMaterial.color.multiplyScalar(2.0);
            laserGlowMaterial = own(new THREE.MeshBasicMaterial({ color: '#40cfff',
                transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
            trailGeometry = own(new THREE.PlaneGeometry(85, 14));
            trailGeometry.translate(-46, 0, 0);
            traceGeometry = own(new THREE.PlaneGeometry(1, 1));
            trailMaterial = own(new THREE.ShaderMaterial({
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
                vertexShader: `varying vec2 trailUv;
                    void main() { trailUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                fragmentShader: `varying vec2 trailUv;
                    void main() {
                        float width = mix(0.12, 1.0, trailUv.x);
                        float edge = abs(trailUv.y * 2.0 - 1.0) / width;
                        float glow = pow(max(0.0, 1.0 - edge), 2.0);
                        float fade = pow(trailUv.x, 0.85);
                        gl_FragColor = vec4(0.35, 0.85, 1.0, glow * fade);
                    }`
            }));

            // Glowing orb + halo ring + a readable letter glyph identify each power-up type,
            // matching the canvas renderer's Shield/RapidFire/TripleShot labels and colors.
            pickupOrbGeometry = own(new THREE.SphereGeometry(8, 20, 14));
            pickupRingGeometry = own(new THREE.TorusGeometry(11.5, 1.1, 8, 28));
            pickupLabelGeometry = own(new THREE.PlaneGeometry(13, 13));
            pickupOrbMaterials = POWERUP_STYLES.map(style => own(new THREE.MeshStandardMaterial({
                color: style.fill, emissive: style.glow, emissiveIntensity: 0.55,
                roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.88
            })));
            pickupRingMaterials = POWERUP_STYLES.map(style => own(new THREE.MeshBasicMaterial({ color: style.fill })));
            pickupLabelMaterials = POWERUP_STYLES.map(style => own(new THREE.MeshBasicMaterial({
                map: own(createLabelTexture(style.label)), transparent: true, depthWrite: false
            })));

            particleGeometry = own(new THREE.CircleGeometry(1, 6));
            traceMesh = own(new THREE.InstancedMesh(traceGeometry, own(new THREE.MeshBasicMaterial({
                color: '#ffffff', transparent: true, opacity: 0.65,
                depthWrite: false, blending: THREE.AdditiveBlending
            })), 512));
            starMesh = own(new THREE.InstancedMesh(particleGeometry, materialFor('#7896b8'), 512));
            for (const mesh of [traceMesh, starMesh]) {
                mesh.count = 0; mesh.frustumCulled = false;
                mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
            }
            renderer.compile(scene, camera);
        },
        setGraphics(settings) {
            if (settings.quality !== graphics.quality) adaptive?.reset();
            graphics = { ...settings };
        },
        getDiagnostics() {
            return { quality: lowQuality ? 'low' : 'high', requestedQuality: graphics.quality,
                ...renderer.info.memory, programs: renderer.info.programs?.length || 0,
                drawCalls: renderer.info.render.calls, ownedResources: owned.size,
                pooledObjects: [...pools.values()].reduce((sum, p) => sum + p.size, 0),
                traceSegments: traceState.segments.length };
        },
        resize(size) {
            lastSize = size;
            adaptive ??= new AdaptiveQuality(size.width < 700);
            applyQuality();
            projectCamera(camera, size.logicalWidth, size.logicalHeight);
        },
        render(frame, deltaMs = 16) {
            if (graphics.quality === 'auto' && adaptive?.sample(deltaMs, frame.isPaused || document.hidden)) applyQuality();
            const reduced = graphics.reducedEffects;
            if (!frame.isPaused && !reduced) elapsed += Math.min(deltaMs, 50);
            atmosphere.update(frame, deltaMs, reduced);
            projectCamera(camera, frame.canvasWidth, frame.canvasHeight);
            shipRig.visible = !!frame.drawPlayer;
            if (shipRig.visible && frame.player) {
                const yaw = -(frame.player.rotation || 0);
                let turnRate = 0;
                if (prevYaw !== null) {
                    const delta = Math.atan2(Math.sin(yaw - prevYaw), Math.cos(yaw - prevYaw));
                    turnRate = frame.isPaused ? 0 : delta / Math.max(deltaMs, 1) * 1000;
                }
                prevYaw = yaw;
                const targetRoll = reduced ? 0 : THREE.MathUtils.clamp(-turnRate * 0.12, -0.5, 0.5);
                if (!frame.isPaused) rollAngle += (targetRoll - rollAngle) * Math.min(1, deltaMs / 120);
                shipRig.position.set(frame.player.x, -frame.player.y, 0);
                const yawQuat = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, yaw);
                const rollQuat = new THREE.Quaternion().setFromAxisAngle(X_AXIS, rollAngle);
                shipRig.quaternion.copy(yawQuat).multiply(rollQuat);
                flame.visible = !!frame.thrusting;
                flame.scale.y = 0.85 + 0.15 * Math.sin(elapsed * 0.04);
                const navOn = Math.sin(elapsed * 0.006) > 0;
                for (const light of navLights) light.material.opacity = navOn ? 1 : 0.25;
            }
            shield.visible = shipRig.visible && !!frame.hasShield;
            if (shield.visible) place(shield, frame.player, 10);

            pool('rocks', frame.asteroids || [], a => {
                const mesh = new THREE.Mesh(rockLibrary.geometryFor(a.visualSeed ?? 0, a.radius), rockLibrary.materialFor(a.visualSeed ?? 0));
                mesh.userData.tilt = rockLibrary.tiltFor(a.visualSeed ?? 0);
                return mesh;
            }, (mesh, a) => {
                mesh.position.set(a.x, -a.y, 0);
                const yaw = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -(a.rotation || 0));
                mesh.quaternion.copy(yaw).multiply(mesh.userData.tilt);
                mesh.scale.setScalar(a.radius);
            }, a => a.id ?? `${a.x},${a.y},${a.radius}`);

            // Velocity-aligned tails have no position history, so wrapping cannot draw a screen-wide streak.
            const segments = traceState.update(frame, deltaMs);
            traceMesh.count = segments.length;
            segments.forEach((segment, index) => {
                const fade = 1 - segment.age / 0.28;
                instanceDummy.position.set(segment.x, -segment.y, 14);
                instanceDummy.rotation.set(0, 0, segment.angle);
                instanceDummy.scale.set(segment.length + 1, 3.5 * fade, 1);
                instanceDummy.updateMatrix(); traceMesh.setMatrixAt(index, instanceDummy.matrix);
                traceMesh.setColorAt(index, traceColor.set('#66dcff').multiplyScalar(fade * fade));
            });
            traceMesh.instanceMatrix.needsUpdate = true;
            if (traceMesh.instanceColor) traceMesh.instanceColor.needsUpdate = true;
            pool('lasers', frame.projectiles || [], () => {
                const group = new THREE.Group();
                const halo = new THREE.Mesh(laserGeometry, laserGlowMaterial);
                halo.scale.set(1.3, 2.3, 1.2);
                group.add(halo, new THREE.Mesh(laserGeometry, laserMaterial), new THREE.Mesh(trailGeometry, trailMaterial));
                return group;
            }, (mesh, p) => {
                place(mesh, { ...p, rotation: Math.atan2(p.velocityY, p.velocityX) }, 15);
            });
            pool('pickups', frame.powerUps || [], () => {
                const group = new THREE.Group();
                const orb = new THREE.Mesh(pickupOrbGeometry, pickupOrbMaterials[0]);
                const ring = new THREE.Mesh(pickupRingGeometry, pickupRingMaterials[0]);
                const label = new THREE.Mesh(pickupLabelGeometry, pickupLabelMaterials[0]);
                label.position.z = 9.5; // in front of the orb's apex (radius 8) so the glyph isn't hidden inside it
                group.add(orb, ring, label);
                group.userData = { orb, ring, label };
                return group;
            }, (group, p) => {
                place(group, p, 15);
                group.rotation.z = 0; // keep the glyph upright and readable; only the orb/ring pulse.
                const type = POWERUP_STYLES[p.type] ? p.type : 0;
                group.userData.orb.material = pickupOrbMaterials[type];
                group.userData.ring.material = pickupRingMaterials[type];
                group.userData.label.material = pickupLabelMaterials[type];
                const pulse = 0.85 + 0.15 * Math.sin(elapsed * 0.006 + (p.x || 0) * 0.02);
                group.scale.setScalar(pulse);
            });
            starMesh.count = 0;
            for (const p of (frame.stars || []).slice(0, 512)) {
                const layer = (p.layer || 0) + 1;
                const wrap = (v, max) => ((v % max) + max) % max;
                const x = wrap(p.x - atmosphere.travel.x * frame.canvasWidth * layer, frame.canvasWidth);
                const y = wrap(p.y + atmosphere.travel.y * frame.canvasHeight * layer, frame.canvasHeight);
                if (!atmosphere.starVisible(x, y, frame.canvasWidth, frame.canvasHeight)) continue;
                instanceDummy.position.set(x, -y, -100); instanceDummy.rotation.set(0, 0, 0);
                instanceDummy.scale.setScalar(p.size || 1); instanceDummy.updateMatrix();
                starMesh.setMatrixAt(starMesh.count++, instanceDummy.matrix);
            }
            starMesh.instanceMatrix.needsUpdate = true;
            pool('particles', reduced ? [] : [...(frame.explosions || []), ...(frame.fireworks || [])].slice(0, lowQuality ? 256 : 512), () => new THREE.Mesh(particleGeometry, own(new THREE.MeshBasicMaterial())), (mesh, p) => {
                place(mesh, p, 50); mesh.material.color.set(p.color || '#ffac55');
                mesh.scale.setScalar(Math.max(0.1, Math.min(4, p.life * 5)));
            });
            combat.update({ ...frame, reducedEffects: reduced, lowQuality }, deltaMs);
            renderer.info.autoReset = false;
            renderer.info.reset();
            composer.render();
        },
        reset() {
            combat?.reset();
            traceState.reset();
            atmosphere?.reset();
            if (traceMesh) traceMesh.count = 0;
            if (starMesh) starMesh.count = 0;
            elapsed = 0;
            prevYaw = null;
            rollAngle = 0;
            for (const [name, map] of pools) {
                for (const object of map.values()) {
                    scene.remove(object);
                    if (name === 'particles' || name === 'traces') { object.material.dispose(); owned.delete(object.material); }
                }
            }
            pools.clear();
        },
        dispose() {
            combat?.dispose();
            traceState.reset();
            atmosphere?.dispose();
            for (const pass of [renderPass, bloom, vignette, outputPass]) pass?.dispose();
            composer?.dispose();
            for (const resource of owned) resource.dispose();
            owned.clear(); pools.clear(); particleMaterials.clear();
            scene?.clear();
            renderer?.dispose();
            renderer?.forceContextLoss();
            renderer = scene = camera = null;
        }
    };
}
