import { test, expect } from '@playwright/test';
import { normalizeGraphics } from '../../wwwroot/js/rendering/graphics-settings.js';

test('graphics settings validate saved values and honor the initial motion preference', () => {
    expect(normalizeGraphics(null, true)).toEqual({ quality: 'auto', reducedEffects: true });
    expect(normalizeGraphics({ quality: 'invalid', reducedEffects: 'yes' })).toEqual({ quality: 'auto', reducedEffects: false });
    expect(normalizeGraphics({ quality: 'high', reducedEffects: false }, true)).toEqual({ quality: 'high', reducedEffects: false });
});

test('WebGL atmosphere and postprocessing support quality changes, reduced effects and resize', async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?manual');
    await page.waitForFunction(() => window.fixtureReady);
    expect(await page.evaluate(() => fixture.init('webgl'))).toBe('webgl');
    expect(await page.evaluate(() => fixture.getGraphics())).toEqual({ quality: 'auto', reducedEffects: true });
    for (const quality of ['high', 'low', 'auto']) {
        await page.evaluate(quality => {
            fixture.setGraphics({ quality, reducedEffects: false });
            fixture.frame.player.velocityX = 100;
            fixture.draw(50);
        }, quality);
        await page.screenshot({ path: info.outputPath(`atmosphere-${quality}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
        Object.assign(fixture.frame, fixture.makeFrame());
        await fixture.init('webgl'); fixture.draw();
    });
    await page.screenshot({ path: info.outputPath('atmosphere-portrait.png') });
    await page.evaluate(() => {
        fixture.setGraphics({ quality: 'low', reducedEffects: true });
        fixture.draw(); fixture.reset(); fixture.dispose();
    });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('asteroids.graphics'))))
        .toEqual({ quality: 'low', reducedEffects: true });
    expect(errors.filter(e => !e.includes('favicon'))).toEqual([]);
});
