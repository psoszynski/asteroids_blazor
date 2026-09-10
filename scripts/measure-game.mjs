import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const output = { cpu: os.cpus()[0].model, browser: browser.version(), samples: [] };
const summary = numbers => {
    numbers.sort((a,b) => a-b);
    return { median: numbers[Math.floor(numbers.length*.5)], p95: numbers[Math.floor(numbers.length*.95)] };
};
try {
    for (const [layout, width, height] of [['desktop',1920,1080], ['portrait',390,844]]) {
        const page = await browser.newPage({ viewport: { width, height } });
        const start = Date.now();
        await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5239'}/?renderer=webgl&profile`);
        await expect(page.locator('.game-renderer-host')).toHaveAttribute('data-renderer', 'webgl', { timeout: 60000 });
        const startupMs = Date.now() - start;
        await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowRight');
        // A real simulation/interop loop, not isolated renderer draw calls.
        await page.waitForTimeout(20000);
        await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight');
        const frames = await page.evaluate(() => gameLoop.getFrameMeasurements());
        const active = frames.slice(10).filter(f => !f.gameOver);
        expect(active.length).toBeGreaterThan(10);
        output.samples.push({ layout, startupMs, frames: active.length,
            intervalMs: summary(active.map(f => f.intervalMs)), interopMs: summary(active.map(f => f.interopMs)),
            renderSubmissionMs: summary(active.map(f => f.renderSubmissionMs)),
            diagnostics: await page.evaluate(() => gameLoop.getGraphicsDiagnostics()) });
        await page.screenshot({ path: `artifacts/rendering/release-${layout}.png` });
        await page.close();
    }
    await mkdir('artifacts/rendering', { recursive: true });
    await writeFile('artifacts/rendering/release-timings.json', JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
} finally { await browser.close(); }
