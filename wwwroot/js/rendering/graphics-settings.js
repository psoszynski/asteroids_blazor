export function normalizeGraphics(value = {}, reducedMotion = false) {
    return { quality: ['auto', 'high', 'low'].includes(value?.quality) ? value.quality : 'auto',
        reducedEffects: typeof value?.reducedEffects === 'boolean' ? value.reducedEffects : reducedMotion };
}
export function readGraphics() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem('asteroids.graphics')); } catch {}
    return normalizeGraphics(saved, matchMedia('(prefers-reduced-motion: reduce)').matches);
}
export function saveGraphics(value) {
    const settings = normalizeGraphics(value);
    try { localStorage.setItem('asteroids.graphics', JSON.stringify(settings)); } catch {}
    return settings;
}
