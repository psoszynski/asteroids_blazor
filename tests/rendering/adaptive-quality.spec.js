import { test, expect } from '@playwright/test';
import { AdaptiveQuality } from '../../wwwroot/js/rendering/adaptive-quality.js';

test('Auto responds to sustained load, with hysteresis and a recovery cooldown', () => {
    const quality = new AdaptiveQuality(false);
    for (let i = 0; i < 150; i++) quality.sample(34);
    expect(quality.low).toBe(true);
    for (let i = 0; i < 1000; i++) quality.sample(16);
    expect(quality.low).toBe(true); // Good frames cannot bypass the cooldown.
    for (let i = 0; i < 1300; i++) quality.sample(16);
    expect(quality.low).toBe(false);
});

test('isolated stalls and paused frames do not lower quality', () => {
    const quality = new AdaptiveQuality(false);
    for (let i = 0; i < 400; i++) quality.sample(i === 250 ? 150 : 16);
    expect(quality.low).toBe(false);
    for (let i = 0; i < 400; i++) quality.sample(100, true);
    expect(quality.low).toBe(false);
    quality.sample(30000);
    expect(quality.low).toBe(false);
});

test('renderer Auto changes backing quality; explicit High stays fixed', async ({ page }) => {
    await page.goto('/?manual'); await page.waitForFunction(() => window.fixtureReady);
    expect(await page.evaluate(() => fixture.init('webgl'))).toBe('webgl');
    const result = await page.evaluate(() => {
        fixture.setGraphics({ quality: 'auto', reducedEffects: false });
        for (let i = 0; i < 13; i++) fixture.draw(400);
        const auto = fixture.diagnostics().quality;
        fixture.setGraphics({ quality: 'high', reducedEffects: false });
        for (let i = 0; i < 13; i++) fixture.draw(400);
        return { auto, explicit: fixture.diagnostics().quality };
    });
    expect(result).toEqual({ auto: 'low', explicit: 'high' });
});
