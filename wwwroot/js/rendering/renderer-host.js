import { createCanvasRenderer } from './canvas-renderer.js';
import { createCollisionOverlay } from './collision-overlay.js';
import { readGraphics, saveGraphics } from './graphics-settings.js';

export function createRendererHost(host, { renderer = 'canvas', debug = false, onContextLost = () => {} } = {}) {
    let active, canvas, overlay, size, runId, disposed = false;
    let settings = readGraphics();
    const lost = event => { event.preventDefault(); onContextLost(); };
    const api = {
        get kind() { return active?.kind; },
        getGraphics() { return { ...settings }; },
        getDiagnostics() { return active?.getDiagnostics?.() || { quality: 'canvas' }; },
        setGraphics(value) {
            settings = saveGraphics(value);
            host.closest('.game-container')?.setAttribute('data-reduced-effects', String(settings.reducedEffects));
            active?.setGraphics?.(settings);
            if (size) api.resize(size);
            return { ...settings };
        },
        async init() {
            canvas = document.createElement('canvas');
            canvas.className = 'game-canvas';
            canvas.setAttribute('aria-label', 'Asteroids playfield');
            try {
                if (renderer === 'webgl') {
                    const { createThreeRenderer } = await import('./three-renderer.js');
                    if (disposed) return;
                    active = createThreeRenderer();
                } else active = createCanvasRenderer();
                await active.init(canvas);
            } catch (error) {
                active?.dispose();
                if (disposed) return;
                console.warn('3D renderer unavailable; using Canvas 2D.', error);
                // A canvas cannot switch from WebGL to a 2D context.
                canvas = document.createElement('canvas');
                canvas.className = 'game-canvas';
                canvas.setAttribute('aria-label', 'Asteroids playfield');
                active = createCanvasRenderer();
                await active.init(canvas);
            }
            if (disposed) { active?.dispose(); return; }
            canvas.addEventListener('webglcontextlost', lost);
            host.append(canvas);
            host.dataset.renderer = active.kind;
            host.closest('.game-container')?.setAttribute('data-reduced-effects', String(settings.reducedEffects));
            active.setGraphics?.(settings);
            if (debug) overlay = createCollisionOverlay(host);
            if (size) api.resize(size);
        },
        resize(nextSize) { size = nextSize; if (active && !disposed) { active.resize(size); overlay?.resize(size); } },
        render(frame, deltaMs) {
            if (disposed) return;
            if (frame.runId !== runId) { api.reset(); runId = frame.runId; }
            active.render(settings.reducedEffects ? { ...frame, reducedEffects: true, screenShake: 0 } : frame, deltaMs);
            overlay?.render(frame);
        },
        reset() { active?.reset(); },
        dispose() {
            disposed = true;
            canvas?.removeEventListener('webglcontextlost', lost);
            active?.dispose();
            active = null;
            canvas?.remove();
            overlay?.dispose();
        }
    };
    return api;
}
