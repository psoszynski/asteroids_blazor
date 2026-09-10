// Uses complete frame intervals (including interop), not just draw submission time.
export class AdaptiveQuality {
    constructor(low = false) { this.low = low; this.reset(); }
    reset() { this.elapsed = 0; this.samples = []; this.slow = 0; this.fast = 0; this.cooldown = 4000; }
    sample(ms, paused = false) {
        if (paused || !Number.isFinite(ms) || ms <= 0 || ms > 1000) {
            this.samples = []; this.elapsed = 0; this.slow = this.fast = 0;
            return false;
        }
        this.cooldown = Math.max(0, this.cooldown - ms);
        this.samples.push(ms); this.elapsed += ms;
        if (this.elapsed < 2000) return false;
        const sorted = this.samples.sort((a,b) => a-b);
        const p75 = sorted[Math.floor(sorted.length * 0.75)];
        this.samples = []; this.elapsed = 0;
        this.slow = p75 > 25 ? this.slow + 1 : 0;
        this.fast = p75 < 18 ? this.fast + 1 : 0;
        if (this.cooldown) return false;
        if ((!this.low && this.slow >= 2) || (this.low && this.fast >= 6)) {
            this.low = !this.low; this.cooldown = 30000;
            this.slow = this.fast = 0;
            return true;
        }
        return false;
    }
}
