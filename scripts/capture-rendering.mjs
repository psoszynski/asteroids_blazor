import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import os from 'node:os';
const output = 'artifacts/rendering';
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['scripts/rendering-server.mjs'], { stdio: 'pipe', env: process.env });
let browser;
try {
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(new Error(`Fixture server exited: ${code}`))); });
    browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
    const results = { machine: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model }, samples: [] };
    if (process.env.BASELINE_SOURCE) results.baselineSha256 = createHash('sha256').update(await readFile(process.env.BASELINE_SOURCE)).digest('hex');
    for (const [layout, width, height] of [['desktop',1440,900],['portrait',390,844]]) {
        for (const dense of [false,true]) {
            for (const kind of [...(process.env.BASELINE_SOURCE ? ['baseline'] : []), 'canvas', 'webgl']) {
                const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
                await page.goto(`http://127.0.0.1:4179/?manual${dense ? '&dense' : ''}`);
                await page.waitForFunction(() => window.fixtureReady);
                if (kind === 'baseline') {
                    await page.addScriptTag({ url: '/baseline.js', type: 'module' });
                    await page.evaluate(() => {
                        const canvas = document.createElement('canvas'); canvas.className = 'game-canvas';
                        canvas.width = innerWidth*devicePixelRatio; canvas.height = innerHeight*devicePixelRatio;
                        document.getElementById('host').append(canvas);
                        const ctx = canvas.getContext('2d');
                        fixture.draw = delta => gameRenderer.render(ctx, fixture.frame, delta);
                    });
                } else {
                    await page.evaluate(kind => fixture.init(kind), kind);
                    // Hold quality fixed so before/after captures compare the same preset.
                    await page.evaluate(layout => fixture.setGraphics({ quality: layout === 'desktop' ? 'high' : 'low', reducedEffects: false }), layout);
                }
                const timing = await page.evaluate(() => fixture.benchmark());
                const name = `${kind}-${layout}-${dense ? 'dense' : 'normal'}`;
                await page.screenshot({ path: `${output}/${name}.png` });
                results.samples.push({ name, ...timing, diagnostics: kind === 'baseline' ? null : await page.evaluate(() => fixture.diagnostics()) });
                console.log(`${name}: frame p95 ${timing.frameIntervalMs.p95.toFixed(1)}ms`);
                await page.close();
            }
        }
    }
    await writeFile(`${output}/timings.json`, JSON.stringify(results, null, 2));
} finally { await browser?.close(); server.kill(); }
