// Explicitly enabled only by local development entry points. Radii match GameConstants.
export function createCollisionOverlay(host) {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas collision-overlay';
    canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    host.append(canvas);
    const ctx = canvas.getContext('2d');
    return {
        resize({ width, height, pixelRatio }) {
            canvas.width = Math.round(width * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);
        },
        render(frame) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(canvas.width / frame.canvasWidth, canvas.height / frame.canvasHeight);
            ctx.strokeStyle = '#ff5be1';
            ctx.lineWidth = 1;
            const circle = (p, radius) => {
                ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
            };
            for (const a of frame.asteroids || []) circle(a, a.radius);
            if (frame.drawPlayer) circle(frame.player, 10);
            for (const p of frame.powerUps || []) circle(p, 12);
            for (const p of frame.projectiles || []) circle(p, 1);
            ctx.restore();
        },
        dispose() { canvas.remove(); }
    };
}
