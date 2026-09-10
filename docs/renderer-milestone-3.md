# Combat effects

Milestone 3 adds WebGL combat feedback. Select `?renderer=webgl`; Canvas remains the default.

- The engine emits up to 64 visual events per update, each with a monotonically increasing per-run ID, run ID, type, position, scale, and direction. Asteroid destruction, player damage, shield absorption, and pickup collection emit separate events. Pickup direction carries the power-up type for color selection. Existing sound emission remains independent.
- A run-aware event watermark consumes each event once. Up to 24 simultaneous decorative bursts use preallocated slots with shared geometry and instanced sparks, rotating fragments, and dust. Each slot has 12 fragment, 20 spark, and 8 dust instances. Exhausted slots replace the oldest decoration without changing gameplay entities.
- Impacts produce a short flash, expanding ring, sparks, and up to four temporary point lights. Asteroid impacts also produce fragments and dust. The shield is a translucent sphere with edge glow; shield absorption produces a blue expanding impact ripple at the collision position. Pickups retain their illuminated orb and readable glyph, with a color-matched collection burst.
- The engine plume has a pale core, translucent blue envelope, and a nearby blue light. Projectile tails taper behind the current velocity. A brighter lingering trace deposits short motion segments that fade over 0.28 seconds, bounded to 512 segments. Wrapped steps break the trace, pause freezes it, and restart clears it.
- Pause freezes effect age, plume modulation, and ship banking. Effects continue fading during wave transitions and game over, expire after 1.2 seconds, and clear on reset or a changed run ID. Frame deltas are capped at 50 ms, so delayed frames cannot create resume-time bursts. Renderer disposal releases instance buffers and all owned effect materials/geometries.

Validation: 26 .NET tests and 16 Chromium/Playwright checks passed, including simultaneous distinct impacts, sound count, damage versus shield events, pickup events, replay protection, pause, expiry, run reset, bounded burst count, and WebGL rendering/disposal. The combat screenshot from the browser test was visually inspected; generated screenshots are in ignored `test-results/` directories. Desktop and portrait renderer checks, fallback, and context recovery also passed.

The full Blazor build passed with zero warnings/errors. Live-game Chromium smoke checks passed for Canvas and WebGL: movement, shooting, pause/resume, portrait resize, and WebGL context recovery. The final pause-animation adjustment also passed a focused rerun of all three combat checks.

This is fixture and automated coverage, not a hardware performance certification. Firefox, Safari, physical phones, and sustained dense-combat profiling remain outstanding for milestone 5. Atmosphere, bloom, graphics settings, and reduced-effects controls remain milestone 4 work.
