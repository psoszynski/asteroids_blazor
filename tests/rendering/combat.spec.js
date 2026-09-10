import { test, expect } from '@playwright/test';
import { EffectState } from '../../wwwroot/js/rendering/effect-state.js';
import { ProjectileTrailState } from '../../wwwroot/js/rendering/projectile-trails.js';

test('projectile traces linger, freeze, expire, break at wraps and reset', () => {
    const state = new ProjectileTrailState();
    const frame = { runId: 1, canvasWidth: 800, canvasHeight: 600,
        projectiles: [{ x: 100, y: 100, velocityX: 400, velocityY: 0 }] };
    expect(state.update(frame, 16)).toHaveLength(1);
    expect(state.update({ ...frame, projectiles: [], isPaused: true }, 1000)[0].age).toBe(0);
    expect(state.update({ ...frame, projectiles: [] }, 50)).toHaveLength(1);
    for (let i = 0; i < 6; i++) state.update({ ...frame, projectiles: [] }, 50);
    expect(state.segments).toHaveLength(0);
    expect(state.update({ ...frame, projectiles: [{ ...frame.projectiles[0], x: 1 }] }, 16)).toHaveLength(0);
    state.update(frame, 16);
    expect(state.update({ ...frame, runId: 2, projectiles: [] }, 16)).toHaveLength(0);
    for (let i = 0; i < 20; i++) state.update({ ...frame,
        projectiles: Array.from({ length: 100 }, () => frame.projectiles[0]) }, 16);
    expect(state.segments.length).toBeLessThanOrEqual(512);
});

test('combat events deduplicate, freeze, expire, and clear on a new run', () => {
    const state = new EffectState();
    const event = { id: 1, runId: 1, type: 'asteroid', x: 100, y: 120, scale: 25 };
    const frame = { runId: 1, visualEvents: [event, { ...event, id: 2, x: 400 }] };
    expect(state.update(frame, 16)).toHaveLength(2);
    expect(state.update(frame, 16)).toHaveLength(2);
    const age = state.bursts[0].age;
    state.update({ ...frame, isPaused: true }, 10000);
    expect(state.bursts[0].age).toBe(age);
    for (let i = 0; i < 30; i++) state.update(frame, 50);
    expect(state.bursts).toHaveLength(0);
    state.update({ runId: 2, visualEvents: [event, { ...event, runId: 2 }] }, 16);
    expect(state.bursts).toHaveLength(1);
    expect(state.bursts[0].runId).toBe(2);
    state.reset(); expect(state.bursts).toHaveLength(0);
});

test('decorative burst count remains bounded', () => {
    const state = new EffectState();
    state.update({ runId: 1, visualEvents: Array.from({ length: 64 }, (_, i) => ({ id: i + 1, runId: 1 })) }, 16);
    expect(state.bursts).toHaveLength(24);
});

test('WebGL renders simultaneous combat effects and survives reset', async ({ page }, info) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/?manual');
    await page.waitForFunction(() => window.fixtureReady);
    expect(await page.evaluate(() => fixture.init('webgl'))).toBe('webgl');
    await page.evaluate(() => {
        fixture.frame.runId = 50;
        fixture.frame.hasShield = true;
        fixture.frame.visualEvents = ['asteroid', 'damage', 'shield', 'pickup'].map((type, i) => ({
            id: i + 1, runId: 50, type, x: 200 + i * 180, y: 300, scale: 35, direction: 0
        }));
        fixture.draw();
        for (let i = 0; i < 5; i++) fixture.draw(16);
    });
    await page.screenshot({ path: info.outputPath('combat.png') });
    await page.evaluate(() => {
        fixture.frame.isPaused = true; fixture.draw(5000);
        fixture.frame.runId++; fixture.frame.visualEvents = []; fixture.draw();
        fixture.reset(); fixture.draw(); fixture.dispose();
    });
    expect(errors).toEqual([]);
    await expect(page.locator('#host canvas')).toHaveCount(0);
});
