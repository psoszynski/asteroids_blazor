// Small vector glyphs so each floating power-up pickup reads at a glance
// instead of a bare letter: a shield outline (Shield), a lightning bolt
// (RapidFire), and three fanning chevrons (TripleShot, evoking a spread
// shot). Shared by canvas-renderer.js (drawn straight onto the 2D canvas)
// and three-renderer.js (drawn onto an offscreen canvas used as a texture)
// so both renderers show the same glyph for a given power-up type.
//
// Paths are centered on the caller's current origin and scaled by `size`
// (roughly the icon's half-height). Callers translate/rotate first and set
// fillStyle/strokeStyle/shadow before calling; this only builds and fills
// or strokes the path.

function shieldPath(ctx, size) {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(0, -0.95 * s);
    ctx.bezierCurveTo(0.42 * s, -0.85 * s, 0.68 * s, -0.62 * s, 0.68 * s, -0.22 * s);
    ctx.bezierCurveTo(0.68 * s, 0.32 * s, 0.38 * s, 0.72 * s, 0, 0.98 * s);
    ctx.bezierCurveTo(-0.38 * s, 0.72 * s, -0.68 * s, 0.32 * s, -0.68 * s, -0.22 * s);
    ctx.bezierCurveTo(-0.68 * s, -0.62 * s, -0.42 * s, -0.85 * s, 0, -0.95 * s);
    ctx.closePath();
}

function boltPath(ctx, size) {
    const s = size;
    ctx.beginPath();
    ctx.moveTo(0.16 * s, -0.98 * s);
    ctx.lineTo(-0.52 * s, 0.12 * s);
    ctx.lineTo(-0.04 * s, 0.12 * s);
    ctx.lineTo(-0.2 * s, 0.98 * s);
    ctx.lineTo(0.56 * s, -0.18 * s);
    ctx.lineTo(0.08 * s, -0.18 * s);
    ctx.closePath();
}

function tripleShotPath(ctx, size) {
    const s = size;
    ctx.lineWidth = Math.max(1, 0.24 * s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const chevron = (offsetX, angle, height) => {
        ctx.save();
        ctx.translate(offsetX * s, 0.32 * s);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-0.32 * s, height * s);
        ctx.lineTo(0, -height * s);
        ctx.lineTo(0.32 * s, height * s);
        ctx.stroke();
        ctx.restore();
    };
    chevron(-0.4, -0.32, 0.5);
    chevron(0, 0, 0.66);
    chevron(0.4, 0.32, 0.5);
}

/**
 * Draws the glyph for a power-up type at the current origin.
 * type: 0 = Shield, 1 = RapidFire, 2 = TripleShot (any other value falls back to Shield).
 */
export function drawPowerUpIcon(ctx, type, size) {
    switch (type) {
        case 1:
            boltPath(ctx, size);
            ctx.fill();
            break;
        case 2:
            tripleShotPath(ctx, size);
            break;
        default:
            shieldPath(ctx, size);
            ctx.fill();
            break;
    }
}
