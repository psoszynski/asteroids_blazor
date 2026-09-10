// Frame events are ordered by the engine. A watermark prevents replay after recovery.
export class EffectState {
    constructor() { this.reset(); }
    reset() { this.runId = null; this.lastId = 0; this.bursts = []; }
    update(frame, deltaMs) {
        if (this.runId !== frame.runId) { this.reset(); this.runId = frame.runId; }
        const dt = frame.isPaused ? 0 : Math.max(0, Math.min(deltaMs, 50)) / 1000;
        for (const burst of this.bursts) burst.age += dt;
        this.bursts = this.bursts.filter(b => b.age < 1.2);
        for (const event of frame.visualEvents || []) {
            if (event.runId !== this.runId || event.id <= this.lastId) continue;
            this.lastId = event.id;
            if (this.bursts.length === 24) this.bursts.shift();
            this.bursts.push({ ...event, age: 0 });
        }
        return this.bursts;
    }
}
