# Cinematic 3D visual upgrade

Status: milestones 1–5 implemented. Builds on the current pseudo-3D canvas visuals. See [milestone 1 validation](docs/renderer-milestone-1.md), [milestone 2 validation](docs/renderer-milestone-2.md), [milestone 3 validation](docs/renderer-milestone-3.md), [milestone 4 validation](docs/renderer-milestone-4.md), and [milestone 5 validation](docs/renderer-milestone-5.md).

**Intended result**

A top-down space shooter with genuinely three-dimensional ships and asteroids, responsive lighting, and satisfying destruction. The visual direction is dark cinematic space: silver spacecraft, rugged mineral rocks, icy blue engines, and orange explosions. Ship movement, aiming, collisions, waves, scoring, and power-ups retain their existing rules.

Use Three.js with an orthographic camera looking straight down at the gameplay plane. Object height, asteroid tumble, and ship banking provide depth without changing apparent distance, aim, or movement. Keep the Blazor HUD above the rendered scene.

**Architecture and implementation decisions**

- `Game/GameEngine.cs` remains authoritative for gameplay. `Models/GameModels.cs` carries positions, persistent entity IDs, a run ID, and explicit visual events to JavaScript.
- `wwwroot/js/game.js` retains the input, audio, storage, and frame bridge. Extract drawing into interchangeable renderers with `init`, `render`, `resize`, `reset`, and `dispose` operations.
- Add renderer modules under `wwwroot/js/rendering/` for the scene, entity visuals, effects, background, and quality settings. Preserve the current canvas renderer as a compatibility fallback.
- Use a pinned Three.js dependency and a small npm/esbuild asset build. Bundle locally served JavaScript into `wwwroot/js/dist/`; add reproducible npm scripts and a lockfile. Run the asset build before .NET build/publish locally and in the existing GitHub workflow. Document the new prerequisites and development command.
- Select the renderer before creating a canvas context. Modern Three.js WebGLRenderer requires WebGL 2. Use a fresh renderer-owned canvas when changing context types, managed through a host element in `Pages/Game.razor`. On startup failure, use Canvas 2D; on context loss, pause safely and offer recovery. [Three.js renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html)
- Start with original procedural geometry and generated material maps. This makes the first complete version independent of downloaded art. Keep model creation separate so a custom GLB ship can replace it later.

**1. Establish a baseline and renderer foundation**

Capture representative current-game screenshots and frame timings at desktop and portrait sizes, including dense combat. Add a deterministic visual fixture that can replay identical scenes through either renderer.

Extract the current canvas renderer, add asynchronous renderer startup, and integrate the local asset bundle. Keep one animation loop and one simulation update in flight. Fix listener cleanup while touching lifecycle code: existing keyboard listeners are removed using newly created function references. Ensure pending frame callbacks cannot render into a disposed or replacement scene.

Map C# screen coordinates into the orthographic scene explicitly, including Y direction and rotation sign. Continue using the existing virtual dimensions on mobile; resize the camera, backing buffer, and post-processing targets together. Add a development-only collision-boundary overlay.

Completion check: both renderers can display and control the same game, with correct orientation, edge wrapping, pause, restart, resize, and disposal. No duplicate input listeners or animation loops after restarting the renderer.

**2. Deliver the first playable 3D scene**

Create a recognizable ship with a beveled metal hull, layered wings, dark recesses, glass-like cockpit, emissive engine nozzles, and navigation lights. Add restrained visual banking while turning; the gameplay transform remains on the plane.

Create a reusable library of irregular asteroid meshes with rough mineral surfaces, broad facets, recessed craters, and subtle color variation. Use stable visual seeds and entity IDs so rocks keep their appearance as frame lists change. Derive seeds independently of the gameplay random stream. Scale every mesh variant and its tumble envelope to the existing collision radius, checking it with the overlay.

Add directional key lighting, subtle fill, and an environment reflection source so metal reads differently from stone. Keep shadowed surfaces visible. Start with material shading and baked surface occlusion; reserve dynamic shadow maps for the high-quality tier if measurements justify them.

Completion check: ship and rocks look convincingly solid at actual gameplay size, rotation reveals changing surfaces, and bullets hit where the player expects. Capture matching before/after desktop and mobile scenes.

**3. Make combat react visually**

Add bounded visual-event records to `FrameResult`: event ID, run ID, type, position, scale, and direction where relevant. Emit them at asteroid destruction, player damage, shield absorption, and pickup collection. The current single explosion-radius field cannot describe several separate impacts in one frame. Consume each event once; clear old events and effect pools on a new run.

Build blue engine plumes, tapered projectile trails, orange impact flashes, expanding shockwaves, sparks, dust, and rotating rock fragments. Debris is decorative; the C# engine continues spawning the actual smaller asteroids. Add a translucent shield with edge glow and an impact ripple, plus distinct illuminated pickup models with readable symbols.

Use a small pool of temporary lights to illuminate nearby surfaces at engines and impacts. Reuse particle buffers and geometry. Define effect timing for pause, wave transitions, game over, and restart explicitly; prevent resume-time bursts or repeated effects. Break trails at screen wraps.

Completion check: simultaneous explosions appear at the correct locations exactly once, fragments stay within resource limits, and no stale trails or flashes survive restart. Existing audio still fires once per gameplay event.

**4. Build atmosphere and finish the image**

Add layered stars, softly textured nebulae, distant planets with atmospheric rims, and sparse drifting dust. Tie subtle parallax to continuous travel, avoiding jumps when the ship wraps. Keep backgrounds dim and behind all gameplay objects.

Add restrained bloom, consistent tone mapping/output color, and a light vignette. Use emissive intensity and thresholds so engines and explosions glow while rock surfaces and text remain sharp. Resize all effect targets correctly. Three.js provides an EffectComposer pipeline for applying these passes. [Post-processing documentation](https://threejs.org/manual/en/post-processing.html)

Refine HUD spacing, panel materials, and wave transitions to match the scene. Expose graphics quality and reduced-effects controls in the pause UI; reduced effects suppress camera shake, strong flashes, and decorative motion. Respect the system reduced-motion preference initially.

Completion check: enemies, projectiles, pickups, and controls remain legible during the busiest effects, in portrait orientation, and with reduced effects enabled.

**5. Optimize, validate, and finish delivery**

Use shared meshes/materials, pooled particles, and instancing where profiling shows value. Bound decorative debris and temporary lights without hiding live gameplay entities. Dispose owned geometries, materials, textures, and post-processing targets when the renderer is destroyed; scene removal alone does not release these resources. [Resource disposal documentation](https://threejs.org/manual/en/how-to-dispose-of-objects.html)

Implement Auto, High, and Low quality. Adjust backing resolution, bloom resolution, debris density, and dynamic lights with sustained measurements and hysteresis. Keep controls and simulation rules identical across quality levels.

Performance targets are goals to verify on named test hardware, not promises: approximately 60 FPS on a representative desktop at 1080p and at least 30 FPS on a representative phone in Low mode. Record frame-time percentiles during ordinary play, dense later waves, and simultaneous explosions. Measure the whole frame, including C# interop and GPU work, rather than timing only JavaScript draw submission. Run a ten-minute soak and repeated restarts to detect growing resource counts. Record compressed asset size and cold-start time against the baseline.

Validation includes:

- Existing .NET tests, plus focused tests for stable IDs, run resets, and multiple distinct visual events.
- Browser checks for startup, keyboard/touch controls, firing, splitting rocks, pickups, damage, pause/resume, wave changes, game over, restart, and resize.
- Deterministic visual comparisons covering all asteroid sizes, bright/dark backgrounds, invulnerability, active shields, and every quality setting.
- Desktop Chrome, Firefox, and Safari checks; real iOS Safari and Android Chrome checks when devices are available. Report unavailable device coverage explicitly.
- WebGL-unavailable startup, simulated context loss/recovery, failed asset loading, and repeated renderer mount/disposal.
- Release build and published-site smoke test confirming bundled assets load without development tooling or external CDNs. Update README and ARCHITECTURE to describe the final implementation.

Completion check: a playable published build, recorded performance and browser results, before/after captures, and no known gameplay regressions. Publishing to an external environment is a separate action from preparing and testing the build.

**Delivery order and scope**

Implement phases 1–2 first as a complete playable slice. This establishes model quality, collision readability, and renderer performance before adding expensive effects. Follow with combat effects, atmosphere, and final optimization in that order; run the relevant checks at each milestone.

The initial release includes procedural 3D models, dynamic impact lighting, bounded debris effects, bloom, atmospheric scenery, quality controls, and the canvas fallback. Custom authored GLB models, elaborate fracture simulation, volumetric clouds, and more expensive shadow effects are later refinements after profiling and visual review.
