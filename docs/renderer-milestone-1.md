# Renderer foundation: implementation and validation

Milestone 1 provides interchangeable Canvas 2D and Three.js renderers, an asynchronous lifecycle, and a repeatable comparison fixture. Canvas remains the default. Use `?renderer=webgl` to preview primitive 3D geometry and `&collisions` on localhost to inspect collision boundaries. Detailed ship/rock assets, persistent per-entity visuals, bloom, and advanced combat effects belong to later milestones.

**Implemented**

- Extracted the existing pseudo-3D canvas renderer into an instance with explicit init, render, resize, reset, and dispose operations.
- Added an orthographic WebGL preview rendering the existing player, asteroids, projectiles, stars, particles, shield, and pickups from C# snapshots. Screen Y and rotation map explicitly into Three.js world coordinates.
- Added a renderer-owned canvas under a Blazor host element. Startup failure, an unavailable WebGL context, or missing renderer bundles can fall back to Canvas 2D. Context loss offers recovery without restarting the game.
- Added a run ID for clearing renderer state on restart and a renderer-suspension clock so startup/recovery do not consume game timers or change an existing user pause.
- Added per-session input listeners, pointer cancellation, stale-frame rejection, serialized simulation/resize calls, and disposal that drains pending interop. Score persistence stays off the frame-critical path.
- Pinned Three.js 0.186.0, esbuild 0.28.2, and Playwright 1.63.0. The .NET build/publish target bundles local assets; CI installs dependencies and runs browser tests. The Three.js chunk loads only for the WebGL preview.

**Validation performed**

- .NET build passed with zero warnings/errors. All 18 .NET tests passed, including new clock suspension, pause preservation, and run reset tests.
- All 13 Chromium browser tests passed: desktop/portrait fixtures for both renderers, coordinate mapping, resizing, reset/disposal, keyboard and pointer controls, pause pulses, fallback on missing WebGL/chunks/entry bundles, concurrent starts, asynchronous startup cancellation, context recovery, and slow score persistence.
- Real Blazor smoke checks passed for both renderers: movement/rotation input, shooting, pause/resume, portrait resize preserving the run, and WebGL context-loss recovery preserving an existing pause. The smoke checks also passed against locally served Release output.
- Release output includes the entry bundle and lazy Three.js chunk. The SDK reported that the optional wasm-tools optimization workload is not installed; publishing still succeeded.
- Inspected desktop and portrait screenshots. Generated images and timing data are under `artifacts/rendering/` (ignored by Git). Use the scripts described in README to regenerate them.

**Initial baseline capture**

Captured the pre-extraction pseudo-3D renderer, extracted Canvas renderer, and primitive WebGL preview with identical seeded entity layouts. These are initial foundation measurements, before the final lifecycle and particle-material cleanup. Each sample records 120 frames after ten warm-up frames at DPR 2. Normal scenes contain 12 asteroids, 4 projectiles, and 10 explosion particles; dense scenes contain 90 asteroids, 45 projectiles, and 200 particles. Both include 160 stars and three pickups.

Environment: Apple M4 Max, macOS arm64, headless Chromium 153.0.8010.12 with `--enable-unsafe-swiftshader`. These are browser frame-interval measurements from a renderer fixture, not isolated GPU timings or complete game-loop benchmarks. Headless rendering is much slower here than CPU draw submission; these numbers do not establish hardware FPS targets.

| Scene | Original canvas p95 | Extracted canvas p95 | WebGL preview p95 |
| --- | ---: | ---: | ---: |
| Desktop 1440 × 900, normal | 116.7 ms | 116.7 ms | 66.7 ms |
| Desktop 1440 × 900, dense | 133.4 ms | 133.4 ms | 100.0 ms |
| Portrait 390 × 844, normal | 50.0 ms | 33.4 ms | 16.7 ms |
| Portrait 390 × 844, dense | 50.1 ms | 50.1 ms | 33.4 ms |

Draw-submission p95 ranged from 0.4–2.2 ms across these samples, illustrating why submission timing alone cannot establish frame rate. Full data: `artifacts/rendering/timings.json`. Original renderer SHA-256: `b544c6d97781c6a8de2f9d601b35b164b7aabef6d0c8c942c0ea94064cc4a409`.

**Remaining validation and next milestone**

Firefox, Safari, and physical iOS/Android devices were not tested in this milestone. Portrait coverage uses Chromium viewport emulation. Hardware performance tuning and the long-running resource soak remain milestone 5 work. Milestone 2 replaces primitive visuals with detailed meshes/materials and stable entity identities while retaining this lifecycle and coordinate contract.
