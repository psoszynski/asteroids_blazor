// Deposit short motion segments instead of connecting array slots across frames.
// This also works when projectiles are removed or the frame list reorders.
export class ProjectileTrailState {
    constructor() { this.reset(); }
    reset() { this.runId = null; this.segments = []; }
    update(frame, deltaMs) {
        if (this.runId !== frame.runId) { this.reset(); this.runId = frame.runId; }
        if (frame.isPaused) return this.segments;
        const dt = Math.max(0, Math.min(deltaMs, 50)) / 1000;
        for (const segment of this.segments) segment.age += dt;
        this.segments = this.segments.filter(s => s.age < 0.28);
        if (!dt) return this.segments;
        for (const p of frame.projectiles || []) {
            const dx = p.velocityX * dt, dy = p.velocityY * dt;
            const x = p.x - dx, y = p.y - dy;
            // A wrapped step starts a fresh trace instead of crossing the whole playfield.
            if (x < 0 || y < 0 || x > frame.canvasWidth || y > frame.canvasHeight) continue;
            const length = Math.hypot(dx, dy);
            if (length < 0.1) continue;
            this.segments.push({ x: (x + p.x) / 2, y: (y + p.y) / 2,
                angle: -Math.atan2(dy, dx), length, age: 0 });
        }
        if (this.segments.length > 512) this.segments.splice(0, this.segments.length - 512);
        return this.segments;
    }
}
