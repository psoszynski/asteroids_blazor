import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';

const seconds = Number(process.env.SOAK_SECONDS || 600);
if (!Number.isFinite(seconds) || seconds < 1) throw new Error('Invalid SOAK_SECONDS');
await mkdir('artifacts/rendering', { recursive: true });
const server = spawn(process.execPath, ['scripts/rendering-server.mjs'], { stdio: 'pipe' });
let browser;
try {
    await new Promise((resolve, reject) => {
        server.stdout.once('data', resolve); server.once('error', reject);
        server.once('exit', code => reject(new Error(`Fixture server exited: ${code}`)));
    });
    browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
        if (m.text().startsWith('Soak ')) console.log(m.text()); });
    await page.goto('http://127.0.0.1:4179/?manual&dense');
    await page.waitForFunction(() => window.fixtureReady);
    expect(await page.evaluate(() => fixture.init('webgl'))).toBe('webgl');
    const result = await page.evaluate(async seconds => {
        fixture.setGraphics({ quality: 'auto', reducedEffects: false });
        fixture.frame.runId = 100;
        const start = performance.now(), samples = [], intervals = [];
        let previous = start, nextSample = 0, nextBurst = 0, nextReset = 60000, eventId = 0;
        while (performance.now() - start < seconds * 1000) {
            const now = await new Promise(requestAnimationFrame);
            const delta = now - previous; previous = now;
            intervals.push(delta);
            const age = now - start;
            const frame = fixture.frame;
            for (const rock of frame.asteroids) rock.rotation += delta * 0.0002;
            for (const shot of frame.projectiles) shot.y = (shot.y - delta * 0.4 + frame.canvasHeight) % frame.canvasHeight;
            frame.visualEvents = [];
            if (age >= nextBurst) {
                nextBurst = age + 250;
                frame.visualEvents = Array.from({ length: 4 }, (_, i) => ({ id: ++eventId, runId: frame.runId,
                    type: ['asteroid','asteroid','shield','pickup'][i], x: 250+i*300, y: 450,
                    scale: 35, direction: 0 }));
            }
            if (age >= nextReset) {
                nextReset += 60000; frame.runId++; frame.visualEvents = [];
                fixture.reset();
            }
            fixture.draw(delta);
            if (age >= nextSample) {
                nextSample = age + 30000;
                const sample = { seconds: Math.round(age/1000), ...fixture.diagnostics() };
                samples.push(sample); console.log(`Soak ${JSON.stringify(sample)}`);
            }
        }
        intervals.sort((a,b) => a-b);
        return { seconds: (performance.now()-start)/1000, frames: intervals.length, samples,
            frameIntervalMs: { median: intervals[Math.floor(intervals.length*.5)], p95: intervals[Math.floor(intervals.length*.95)] } };
    }, seconds);
    result.mounts = [];
    for (let i = 0; i < 10; i++) {
        expect(await page.evaluate(() => fixture.init('webgl'))).toBe('webgl');
        result.mounts.push(await page.evaluate(() => fixture.diagnostics()));
        await expect(page.locator('#host > canvas')).toHaveCount(1);
    }
    await page.evaluate(() => fixture.dispose());
    await expect(page.locator('#host > canvas')).toHaveCount(0);
    result.errors = errors;
    result.machine = { cpu: os.cpus()[0].model, platform: os.platform(), arch: os.arch(), browser: browser.version(),
        rendering: 'Headless Chromium with SwiftShader permitted; not a physical-device FPS certification' };
    await writeFile('artifacts/rendering/soak.json', JSON.stringify(result, null, 2));
    expect(errors).toEqual([]);
    const warm = result.samples.filter(s => s.seconds >= 60);
    if (warm.length > 1) {
        for (const key of ['geometries', 'textures', 'ownedResources', 'pooledObjects']) {
            const initial = Math.max(...warm.slice(0, 2).map(s => s[key]));
            expect(Math.max(...warm.map(s => s[key])), key).toBeLessThanOrEqual(initial + 4);
        }
    }
    console.log(`Soak complete: ${result.frames} frames, ${result.seconds.toFixed(1)} seconds, 10 renderer remounts.`);
} finally { await browser?.close(); server.kill(); }
