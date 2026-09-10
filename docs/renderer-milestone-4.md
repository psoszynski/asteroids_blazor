# Atmosphere and image finish

The WebGL renderer now draws a dim procedural nebula, two distant shaded planets with atmospheric rims, sparse dust, and layered stars. Parallax integrates player velocity rather than wrapped coordinates. Distant stars are occluded by the planets; gameplay remains in front of all background elements. No external textures or downloaded models are required.

An EffectComposer pipeline applies thresholded bloom, a restrained vignette, ACES filmic tone mapping, and sRGB output. The Blazor HUD stays outside post-processing. Composer buffers and bloom targets resize with the renderer, and all passes and owned resources are disposed during teardown.

The pause menu exposes persistent graphics settings:

- High: bloom enabled, backing pixel ratio capped at 2.
- Low: bloom disabled, backing pixel ratio capped at 1.
- Auto: Low below 700 CSS pixels of viewport width, High otherwise. This is a conservative initial preset, not measured performance adaptation; sustained frame-time adaptation remains milestone 5.
- Reduced effects: initially follows the system reduced-motion preference unless the player saved a choice. Disables bloom, impact flashes/lights, decorative debris/sparks/dust, background drift, and wave animations; freezes decorative ship/pickup modulation. Canvas also suppresses shake and decorative particle effects. Projectiles and impact indicators remain readable.

Settings can change while paused without resuming the simulation. They survive reload and Canvas recovery. The pause panel scrolls on short screens, and controls use associated labels and native keyboard interaction.

Validation: full Blazor build passed with zero warnings/errors. All 19 Chromium browser checks passed; the two graphics checks passed again after final bloom and planet-occlusion adjustments. Coverage includes quality changes, saved values, initial reduced-motion preference, desktop/portrait rendering, resize, reset/disposal, and existing fallback/context-recovery checks. Desktop and portrait screenshots were visually inspected. Artifacts are generated under ignored `test-results/` paths.

Live Blazor smoke checks passed for Canvas and WebGL, including movement, shooting, pause, both graphics controls without accidental resume, portrait resize, and context recovery. The portrait pause-menu screenshot was also inspected.

Real-device performance, Firefox/Safari coverage, sustained quality adaptation, and long-running resource profiling remain milestone 5 work.
