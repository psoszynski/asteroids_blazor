# Detailed models: implementation and validation

Milestone 2 replaces the milestone 1 primitive WebGL preview geometry with a detailed procedural ship
model, a small library of irregular asteroid meshes, stable per-entity visual identity, and richer
lighting. Canvas remains the default renderer; use `?renderer=webgl` to preview. Combat visual events
(explosions, shields, trails), atmosphere, bloom/post-processing, and quality tiers belong to later
milestones.

**Implemented**

- `Asteroid.Id`: a stable per-run identity assigned by `GameEngine` via a monotonically increasing
  counter (`_nextAsteroidId`), independent of the gameplay `Random` stream and never reused within a
  run. Assigned on initial wave spawn, wave transitions, and asteroid splits.
- `Asteroid.VisualSeed`: `GameMath.HashSeed(id)`, a deterministic splitmix32 hash. Rendering choices
  (mesh variant, material variant, tumble tilt) are derived only from this seed, so they never
  perturb the gameplay RNG sequence and stay reproducible for a given ID.
- `three-renderer.js` now keys its asteroid mesh pool by entity ID instead of array position, so a
  rock keeps its mesh/material/tilt across frames regardless of how the underlying list reorders
  when other asteroids are destroyed or split. Lasers, pickups, stars, and particles keep the
  milestone 1 positional pooling since they are transient and have no stable identity.
- A library of 5 asteroid mesh variants: a displaced `IcosahedronGeometry(1, 2)` per variant, with a
  handful of seed-derived broad "lobe" bumps for irregular facets, 2-4 recessed craters, subtle
  per-vertex color variation via vertex colors, and a final uniform rescale so the top-down silhouette
  never exceeds the existing collision radius. Crossed with 4 mineral material tints (silvery basalt,
  warm ochre, icy pale, deep slate). Each rock additionally gets a fixed per-seed body tilt so its
  existing 2D spin reveals changing facets instead of rotating flat.
- A grouped ship model: a beveled/extruded hull, two angled wing blades, a dark recessed underside,
  a glass-like cockpit dome (`MeshPhysicalMaterial` with clearcoat + transparency), a metal engine
  nozzle housing with the existing emissive flame cone, and blinking red/green wingtip navigation
  lights. The ship banks (rolls around its own forward axis) proportional to turn rate, computed from
  frame-to-frame yaw and smoothed; the roll is composed via quaternion (local roll, then world yaw)
  rather than mutating the shared Euler `.rotation` property, avoiding the composition-order bugs that
  approach would introduce across frames.
- Lighting: a key directional light, a dimmer cool-toned fill directional light, and a baked
  `RoomEnvironment` PMREM environment map (via `THREE.PMREMGenerator`) assigned to `scene.environment`,
  so metal hulls and mineral rock surfaces now respond to reflections differently from each other.
- Updated the deterministic rendering fixture (`tests/rendering/fixture.js`) to include per-asteroid
  `id`/`visualSeed` fields (mirroring `GameMath.HashSeed`), matching the real `FrameResult` shape.

**Validation performed**

- .NET build passed with zero warnings/errors. All 22 .NET tests passed (18 from milestone 1 plus 4
  new): `HashSeed` determinism/non-negativity, `CreateAsteroid` ID/seed assignment, `SpawnWave`
  assigning unique sequential IDs, and a `GameEngine`-level check that asteroid IDs are unique within
  a frame, match their hashed visual seed, and stay stable across frames with no destruction.
- All 13 Chromium browser tests in `tests/rendering/renderer.spec.js` passed unchanged, confirming the
  new models did not regress lifecycle, coordinate mapping, fallback, context-loss recovery, or input
  handling.
- Real Blazor smoke checks (`npm run test:game`) passed for both renderers against a running dev
  server: movement/rotation, shooting, pause/resume, resize, and WebGL context-loss recovery.
- Captured desktop/portrait screenshots via `npm run capture:rendering` and visually inspected them
  (including a cropped close-up of the ship). Asteroids show visibly distinct lumpy silhouettes,
  crater recesses, and the four mineral tints without exceeding their collision circles. The ship
  shows a beveled hull, angled wings, a lit glass cockpit dome, a dark engine housing with blue flame,
  and small red/green nav lights.
- Frame-timing samples via the same script showed no regression versus milestone 1 (WebGL desktop
  dense p95 ~67ms vs. milestone 1's ~100ms on this machine; portrait scenes similarly at or below
  milestone 1 numbers). These remain headless Chromium browser measurements, not hardware FPS
  guarantees.

**Remaining validation and next milestone**

Firefox, Safari, and physical iOS/Android devices were not tested in this milestone (same gap as
milestone 1). Milestone 3 adds bounded visual-event records to `FrameResult` (explosion, shield,
pickup, damage events) and builds the reactive combat effects (engine plumes, projectile trails,
impact flashes, shockwaves, debris, shield glow) described in the visual plan, while keeping this
milestone's lifecycle, coordinate, and identity contracts unchanged.
