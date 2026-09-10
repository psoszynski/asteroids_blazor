import { createRendererHost } from '/wwwroot/js/dist/rendering.js';
import { viewport } from '/wwwroot/js/rendering/coordinates.js';
const params = new URLSearchParams(location.search);
const host = document.getElementById('host');
const size = () => viewport(innerWidth, innerHeight, devicePixelRatio);
const seeded = (seed = 1234) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
// Mirrors GameMath.HashSeed (splitmix32): deterministic, independent of the frame's own random stream.
function hashSeed(id) {
    let z = (id + 0x9E3779B9) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35) >>> 0;
    z ^= z >>> 16;
    return z & 0x7FFFFFFF;
}
function makeFrame(dense = false) {
    const random = seeded();
    const { logicalWidth: w, logicalHeight: h } = size();
    return { runId: 1, canvasWidth: w, canvasHeight: h, drawPlayer: true, thrusting: true, hasShield: true,
        player: { x: w * 0.5, y: h * 0.5, rotation: -Math.PI / 2 },
        stars: Array.from({ length: 160 }, () => ({ x: random()*w, y: random()*h, size: 0.5+random(), opacity: .7, layer: 2, twinklePhase: random()*10 })),
        asteroids: Array.from({ length: dense ? 90 : 12 }, (_, i) => {
            const radius = [40, 25, 15][i%3];
            const id = i + 1;
            return { id, visualSeed: hashSeed(id), x: random()*w, y: random()*h, radius, rotation: random()*6,
                points: Array.from({ length: 11 }, (_, j) => { const r = radius*(.8+random()*.2); return { x: Math.cos(j/11*Math.PI*2)*r, y: Math.sin(j/11*Math.PI*2)*r }; }) };
        }),
        projectiles: Array.from({ length: dense ? 45 : 4 }, () => ({ x: random()*w, y: random()*h, velocityX: 0, velocityY: -400 })),
        powerUps: [0,1,2].map(type => ({ type, x: w*.4+type*55, y: h*.65 })),
        explosions: Array.from({ length: dense ? 200 : 10 }, () => ({ x: w*.7+random()*70, y: h*.7+random()*70, color: '#ffb65b', life: .2+random()*.6 })), fireworks: []
    };
}
let renderer;
const frame = makeFrame(params.has('dense'));
window.fixture = {
    frame, size,
    async init(kind = 'canvas', debug = false) {
        renderer?.dispose();
        renderer = createRendererHost(host, { renderer: kind, debug });
        await renderer.init(); renderer.resize(size()); this.draw();
        return renderer.kind;
    },
    draw(delta = 16) {
        const original = Math.random; Math.random = seeded();
        try { renderer.render(frame, delta); } finally { Math.random = original; }
    },
    reset() { renderer.reset(); },
    setGraphics(settings) { return renderer.setGraphics(settings); },
    getGraphics() { return renderer.getGraphics(); },
    diagnostics() { return renderer.getDiagnostics(); },
    dispose() { renderer?.dispose(); },
    makeFrame,
    async benchmark(count = 120) {
        const intervals = [], submission = []; let previous;
        for (let i = 0; i < count + 10; i++) {
            const time = await new Promise(requestAnimationFrame);
            if (previous !== undefined && i >= 10) intervals.push(time-previous);
            previous = time;
            const started = performance.now(); this.draw();
            if (i >= 10) submission.push(performance.now()-started);
        }
        const summarize = values => { values.sort((a,b)=>a-b); return { median: values[Math.floor(values.length*.5)], p95: values[Math.floor(values.length*.95)] }; };
        return { frameIntervalMs: summarize(intervals), submissionMs: summarize(submission), userAgent: navigator.userAgent, dpr: devicePixelRatio };
    }
};
if (!params.has('manual')) await window.fixture.init(params.get('renderer') || 'canvas', params.has('collisions'));
window.fixtureReady = true;
