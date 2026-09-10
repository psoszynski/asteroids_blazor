import { chromium, firefox, webkit, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browserName = process.env.RENDER_BROWSER || 'chromium';
const browser = await ({ chromium, firefox, webkit })[browserName].launch({ headless: true,
    args: browserName === 'chromium' ? ['--enable-unsafe-swiftshader'] : [] });
await mkdir('artifacts/rendering', { recursive: true });
try {
    for (const kind of ['canvas','webgl']) {
        const page = await browser.newPage({ viewport: { width:1440, height:900 } });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.addInitScript(() => {
            let loop;
            Object.defineProperty(window, 'gameLoop', {
                get: () => loop,
                set: value => {
                    loop = value;
                    const start = loop.start;
                    loop.start = (host, ref) => {
                        const invoke = ref.invokeMethodAsync.bind(ref);
                        ref.invokeMethodAsync = async (name,...args) => {
                            const result = await invoke(name,...args);
                            if (name === 'OnFrame') window.latestFrame = result;
                            return result;
                        };
                        return start(host, ref);
                    };
                }
            });
        });
        await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5227'}/?renderer=${kind}&collisions`);
        await expect.poll(() => page.evaluate(() => window.latestFrame?.asteroids?.length), { timeout: 30000 }).toBeGreaterThan(0);
        await expect(page.locator('.game-renderer-host')).toHaveAttribute('data-renderer',kind);
        const runId = await page.evaluate(() => latestFrame.runId);
        await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(250);
        await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight');
        await page.keyboard.press('Space');
        await expect.poll(() => page.evaluate(() => latestFrame.projectiles.length)).toBeGreaterThan(0);
        await page.keyboard.press('p');
        await expect(page.locator('.pause-title')).toBeVisible();
        await page.locator('#graphics-quality').selectOption('low');
        await page.locator('#reduced-effects').check();
        await expect(page.locator('.pause-title')).toBeVisible();
        await expect.poll(() => page.evaluate(() => gameLoop.getGraphics())).toEqual({ quality: 'low', reducedEffects: true });
        await page.locator('#graphics-quality').selectOption('high');
        await page.locator('#reduced-effects').uncheck();
        await expect.poll(() => page.evaluate(() => gameLoop.getGraphics())).toEqual({ quality: 'high', reducedEffects: false });
        await page.locator('#reduced-effects').blur();
        const held = await page.evaluate(() => ({ x:latestFrame.player.x,y:latestFrame.player.y }));
        await page.waitForTimeout(200);
        expect(await page.evaluate(() => ({ x:latestFrame.player.x,y:latestFrame.player.y }))).toEqual(held);
        await page.screenshot({ path: `artifacts/rendering/game-${kind}-${browserName}-desktop.png` });
        await page.setViewportSize({ width:390,height:844 });
        await expect.poll(() => page.evaluate(() => latestFrame.canvasWidth)).toBe(800);
        expect(await page.evaluate(() => latestFrame.runId)).toBe(runId);
        await page.screenshot({ path: `artifacts/rendering/game-${kind}-${browserName}-portrait.png` });
        if (kind === 'webgl') {
            await page.locator('.game-renderer-host > canvas').first().evaluate(c => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
            await page.getByRole('button', {name:'Continue with compatible graphics'}).click();
            await expect(page.locator('.game-renderer-host')).toHaveAttribute('data-renderer','canvas');
            await expect(page.locator('.pause-title')).toBeVisible();
        }
        await page.keyboard.press('p');
        await expect(page.locator('.pause-title')).toBeHidden();
        expect(await page.evaluate(() => latestFrame.runId)).toBe(runId);
        expect(errors).toEqual([]);
        console.log(`${kind}: real engine input, shooting, pause, resize${kind === 'webgl' ? ', context recovery' : ''} passed`);
        await page.close();
    }
} finally { await browser.close(); }
