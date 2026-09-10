import { test, expect } from '@playwright/test';

async function fixture(page, query = '') {
    await page.goto(`/?manual&${query}`);
    await page.waitForFunction(() => window.fixtureReady);
}
async function startLoop(page, kind = 'canvas', delay = 0) {
    await fixture(page, `renderer=${kind}`);
    // game.js resolves production asset URLs relative to document.baseURI.
    await page.evaluate(async delay => {
        const base = document.createElement('base'); base.href = '/wwwroot/'; document.head.append(base);
        window.calls = []; window.inFlight = 0; window.maxInFlight = 0; window.frameCount = 0;
        window.gameSound.play = () => {};
        window.ref = { async invokeMethodAsync(name, ...args) {
            calls.push({ name, args });
            if (name !== 'OnFrame') return;
            inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
            if (delay) await new Promise(resolve => setTimeout(resolve, delay));
            inFlight--; frameCount++;
            return { ...fixture.frame, isPaused: false };
        }};
        await gameLoop.start(document.getElementById('host'), ref);
    }, delay);
    // WebGL cold start (chunk parse, shader compile) can be slow on CI runners
    // without hardware acceleration; give it more room than the default 5s poll.
    await expect.poll(() => page.evaluate(() => frameCount), { timeout: 20000 }).toBeGreaterThan(1);
}

for (const kind of ['canvas', 'webgl']) {
    for (const [name, width, height] of [['desktop', 1440, 900], ['portrait', 390, 844]]) {
        test(`${kind}: ${name} fixture, reset, coordinate mapping and resize`, async ({ page }, info) => {
            await page.setViewportSize({ width, height });
            const errors = []; page.on('pageerror', e => errors.push(e.message));
            await fixture(page);
            expect(await page.evaluate(kind => fixture.init(kind, true), kind)).toBe(kind);
            await expect(page.locator('#host > canvas')).toHaveCount(2);
            const mapped = await page.evaluate(async () => {
                const { place, projectCamera } = await import('/wwwroot/js/rendering/coordinates.js');
                const object = { position: { set(x,y,z) { this.x=x; this.y=y; this.z=z; } }, rotation: {} };
                place(object, fixture.frame.player);
                return { x: object.position.x, y: object.position.y, rotation: object.rotation.z, width: fixture.frame.canvasWidth };
            });
            expect(mapped.x).toBe(mapped.width / 2);
            expect(mapped.y).toBeLessThan(0);
            expect(mapped.rotation).toBe(Math.PI / 2);
            await page.screenshot({ path: info.outputPath(`${kind}-${name}.png`) });
            await page.evaluate(() => { fixture.reset(); fixture.draw(); });
            await page.setViewportSize({ width: height, height: width });
            await page.evaluate(async kind => {
                Object.assign(fixture.frame, fixture.makeFrame());
                await fixture.init(kind);
            }, kind);
            expect(await page.locator('.game-canvas').evaluate(c => c.width)).toBe(height);
            await page.evaluate(() => fixture.dispose());
            await expect(page.locator('#host > canvas')).toHaveCount(0);
            expect(errors).toEqual([]);
        });
    }
}

test('WebGL unavailable falls back on a fresh Canvas 2D element', async ({ page }) => {
    await page.addInitScript(() => {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === 'webgl2' ? null : getContext.call(this, type, ...args); };
    });
    await fixture(page);
    expect(await page.evaluate(() => fixture.init('webgl'))).toBe('canvas');
    await expect(page.locator('#host > canvas')).toHaveCount(1);
});

test('failed WebGL chunk loads the canvas fallback', async ({ page }) => {
    await page.route('**/chunks/**', route => route.abort());
    await fixture(page);
    expect(await page.evaluate(() => fixture.init('webgl'))).toBe('canvas');
});

for (const kind of ['canvas', 'webgl']) {
    test(`${kind}: keyboard, pause pulse, resize, stop and stale frame isolation`, async ({ page }) => {
        await startLoop(page, kind, 45);
        await page.keyboard.down('ArrowUp');
        await expect.poll(() => page.evaluate(() => calls.filter(c => c.name === 'OnFrame').at(-1).args[1].up)).toBe(true);
        await page.keyboard.up('ArrowUp');
        await page.keyboard.press('p');
        await expect.poll(() => page.evaluate(() => calls.filter(c => c.name === 'OnFrame' && c.args[1].pause).length)).toBe(1);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect.poll(() => page.evaluate(() => calls.filter(c => c.name === 'OnResize').length)).toBeGreaterThan(0);
        await page.evaluate(async () => {
            await Promise.all([gameLoop.start(document.getElementById('host'), ref), gameLoop.start(document.getElementById('host'), ref)]);
        });
        await page.keyboard.press('p');
        await expect.poll(() => page.evaluate(() => calls.filter(c => c.name === 'OnFrame' && c.args[1].pause).length)).toBe(2);
        expect(await page.evaluate(() => maxInFlight)).toBe(1);
        await page.evaluate(() => gameLoop.stop());
        const stopped = await page.evaluate(() => frameCount);
        await page.waitForTimeout(120);
        expect(await page.evaluate(() => frameCount)).toBe(stopped);
        await expect(page.locator('#host > canvas')).toHaveCount(0);
    });
}

test('pointer controls clear on cancellation and do not duplicate on restart', async ({ page }) => {
    await startLoop(page);
    // Use a real active pointer: Firefox rejects capture of a synthetic pointer ID.
    const zone = page.locator('#touch-thrust');
    await zone.evaluate(el => el.addEventListener('pointerdown', e => { window.testPointerId = e.pointerId; }, { once: true }));
    const box = await zone.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => calls.filter(c => c.name === 'OnFrame').at(-1).args[1].up)).toBe(true);
    await zone.dispatchEvent('pointercancel', { pointerId: await page.evaluate(() => testPointerId) });
    await expect.poll(() => page.evaluate(() => calls.filter(c => c.name === 'OnFrame').at(-1).args[1].up)).toBe(false);
    await page.mouse.up();
});

test('context loss holds simulation and recovers to canvas without restarting the run', async ({ page }) => {
    await startLoop(page, 'webgl', 45);
    await page.locator('#host > canvas').evaluate(c => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await expect(page.getByRole('button', { name: 'Continue with compatible graphics' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => calls.filter(c => c.name === 'SetRendererSuspended').at(-1).args[0])).toBe(true);
    const held = await page.evaluate(() => frameCount);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => frameCount)).toBe(held);
    await page.getByRole('button', { name: 'Continue with compatible graphics' }).click();
    await expect(page.locator('#host')).toHaveAttribute('data-renderer', 'canvas');
    await expect.poll(() => page.evaluate(() => frameCount)).toBeGreaterThan(held);
    expect(await page.evaluate(() => calls.filter(c => c.name === 'SetRendererSuspended').at(-1).args[0])).toBe(false);
    await expect(page.locator('#host > canvas')).toHaveCount(1);
});


test('a missing entry bundle still permits canvas gameplay', async ({ page }) => {
    await page.route('**/js/dist/rendering.js', route => route.abort());
    // The fixture imports that bundle too, so use only the game loop in a minimal page.
    await page.goto('/wwwroot/js/game.js');
    await page.setContent('<base href="/wwwroot/"><div id="host"></div>');
    await page.addScriptTag({ url: '/wwwroot/js/game.js' });
    await page.evaluate(async () => {
        window.frames = 0;
        const ref = { async invokeMethodAsync(name) {
            if (name !== 'OnFrame') return;
            frames++;
            return { runId:1, canvasWidth:1100, canvasHeight:800, stars:[], asteroids:[] };
        }};
        await gameLoop.start(document.getElementById('host'), ref);
    });
    await expect.poll(() => page.evaluate(() => frames)).toBeGreaterThan(0);
    await expect(page.locator('#host')).toHaveAttribute('data-renderer', 'canvas');
    await page.evaluate(() => gameLoop.stop());
});

test('disposing during asynchronous renderer startup does not attach a stale canvas', async ({ page }) => {
    await fixture(page, 'renderer=webgl');
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let requested = false;
    await page.route('**/chunks/**', async route => { requested = true; await gate; await route.continue(); });
    await page.evaluate(() => {
        const base = document.createElement('base'); base.href='/wwwroot/'; document.head.append(base);
        window.ref = { async invokeMethodAsync() {} };
        window.starting = gameLoop.start(document.getElementById('host'), ref);
    });
    await expect.poll(() => requested).toBe(true);
    await page.evaluate(() => { window.stopping = gameLoop.stop(); });
    release();
    await page.evaluate(() => Promise.all([starting, stopping]));
    await expect(page.locator('#host > canvas')).toHaveCount(0);
});


test('slow score persistence does not stop simulation and teardown drains it', async ({ page }) => {
    await startLoop(page);
    await page.evaluate(() => {
        const original = ref.invokeMethodAsync;
        window.eventFinished = false;
        let sent = false;
        ref.invokeMethodAsync = async (name, ...args) => {
            if (name === 'HandleFrameEvents') {
                await new Promise(resolve => setTimeout(resolve, 250));
                eventFinished = true;
                return;
            }
            const frame = await original(name, ...args);
            if (name === 'OnFrame' && !sent) { sent = true; frame.pendingScores = [{score:123}]; }
            return frame;
        };
    });
    const before = await page.evaluate(() => frameCount);
    await expect.poll(() => page.evaluate(() => frameCount)).toBeGreaterThan(before + 2);
    await page.evaluate(() => gameLoop.stop());
    expect(await page.evaluate(() => eventFinished)).toBe(true);
});
