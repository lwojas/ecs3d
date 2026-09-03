# Raycaster WebAssembly Renderer

This document summarizes the current JavaScript to C++/WebAssembly renderer migration.

## Architecture

```text
Game systems
    |
    v
Raycaster.js
(public API, resources, Phaser upload)
    |
    +-- SoftwareRenderer.js
    |   JavaScript reference and fallback renderer
    |
    +-- WasmRenderer.js
        C++/WASM renderer adapter
            |
            v
        RaycasterRenderer.wasm
```

Existing game consumers continue to use the public `Raycaster` API. Renderer selection is internal; WASM can be selected with the constructor option:

```js
new Raycaster(game, level, { renderer: "wasm" });
```

`SoftwareRenderer.js` remains the reference implementation and fallback when WASM is not ready or fails to initialize.

## Implemented WASM Rendering

The C++ renderer mirrors `SoftwareRenderer.js`'s architecture directly
(`traceRay()` -> `renderColumn()` -> `renderPlane()`/`drawWallSection()`/
`drawSectionCaps()`, plus a `renderSprites()`-equivalent pass), not just its
first wall hit. It currently supports:

- Per-column ray generation, with fisheye-corrected distance and FOV/pitch/
  camera-Z-aware projection.
- Full multi-segment grid DDA traversal: a ray keeps crossing cell
  boundaries (through open gaps, windows, etc.) rather than stopping at the
  first section-bearing cell.
- A per-column visible-interval list (the same open-row bookkeeping
  `subtractInterval()`/`isYVisible()` do in JS), so a column closes exactly
  when it's actually fully occluded, not after one wall hit.
- Wall sections (multiple independent vertical bands per boundary) with
  texture coordinates, lighting, fog, and depth writes.
- Section caps (sill top / lintel underside), drawn as plane fragments the
  same way JS's `drawSectionCaps()` does.
- Floors and ceilings, including per-cell floor/ceiling materials, variable
  floor/ceiling heights, and cell-to-cell transitions -- rendered for every
  traversed segment, not just the one nearest the camera.
- Depth-aware billboard sprites: camera-space projection, world size (with
  scale), texture sampling, per-sprite lighting/fog, alpha, and depth
  testing against the wall depth buffer, drawn back-to-front.
- Oriented (non-billboard) sprites: the sprite's own left/right world-space
  edges are independently projected (not a screen-facing quad), with
  perspective-correct texture-U and depth interpolation across its width --
  same math as `renderOrientedSprite()`, restructured to divide once per
  sprite (reciprocal depths) instead of twice per column.
- RGB point lighting and per-surface fog blending, shared by walls, planes,
  and both sprite kinds via a common per-pixel blend helper
  (`drawSpritePixel()`/`SpriteBlend`).
- Sky/background: a panoramic `level.sky` texture (scrolling horizontally
  with camera angle only, stretched vertically to fill the current sky
  region -- same deliberate non-3D-skybox simplification as
  `renderSky()`), or the flat-colour fallback when none is configured,
  both tracking pitch the same way `fillFlatSky()` does.
- Per-pixel depth buffer (walls write it; sprites test against it; floors/
  ceilings neither write nor test it, matching `SoftwareRenderer.js`).
- RGBA framebuffer output.

Debug wireframe rendering remains JavaScript-only, by design -- see
"Outstanding Work".

## Files

- `scripts/system/Raycaster.js` - Stable public facade, world/resource ownership, renderer selection, Phaser integration, and framebuffer upload.
- `scripts/system/SoftwareRenderer.js` - Complete JavaScript reference renderer.
- `scripts/system/WasmRenderer.js` - Emscripten module loader, packed data uploader, fallback handling, and framebuffer adapter.
- `scripts/system/wasm/RaycasterRenderer.h` - C-compatible data structures and exported WASM functions.
- `scripts/system/wasm/RaycasterRenderer.cpp` - Persistent native renderer state and the wall/floor/ceiling/sprite rendering implementation.
- `scripts/system/wasm/RaycasterRenderer.js` - Generated Emscripten module.
- `scripts/system/wasm/RaycasterRenderer.wasm` - Generated WebAssembly binary.
- `tests/wasm-renderer-contract.test.mjs` - Adapter fallback contract test.
- `tests/wasm-render-parity.test.mjs` - Deterministic JS/WASM render
  comparisons (walls/floors/ceilings, windowed multi-segment boundaries,
  lighting/fog, billboard and oriented sprites, panoramic sky, debug
  overlays) driven
  through the real `Raycaster` -> `WasmRenderer` -> `RaycasterRenderer.wasm`
  path under Node.
- `tools/benchmark-raycaster.mjs` - Repeatable JS-vs-WASM frame-time
  benchmark (`npm run benchmark:raycaster`); see "Performance" below.

## Build

Emscripten must be installed and `em++` must be available on `PATH`.

```sh
npm run build:raycaster-wasm
```

The build uses `em++` with an ES module wrapper and web environment, and exports the renderer ABI plus `malloc`, `free`, and `HEAPU8` for typed-array transfers.

## Data Boundary

Persistent data is uploaded to native memory and retained until explicitly changed:

- Packed `uint16` map cell IDs.
- Packed cell geometry, fog, and material references.
- Wall-section records.
- Material records with numeric texture IDs.
- Decoded RGBA texture pixels.
- Framebuffer and float depth buffer.
- Renderer configuration such as cell size and maximum distance.

Per-frame data uses fixed numeric records:

- Camera: six `float32` values for position, Z, angle, pitch, and FOV.
- Sprites: fixed 40-byte records, now actively rendered (both billboard and
  oriented, dispatched on the `billboard` byte). `WasmRenderer.js` resolves
  each sprite's string `texture` key to a native texture id lazily, the
  first time that key is seen in a frame
  (`resolveSpriteTextureId()`/`loadSpriteSurface`), the same
  decode-and-cache path `SoftwareRenderer.js` uses for sprite textures.
  Sprite texture ids share the material-texture id space but are assigned
  after it, starting from `materials.length` once the world loads.
- Lights: fixed 32-byte records, actively sampled by walls, planes, and
  sprites.
- Ambient lighting value.

The panoramic sky texture (`level.sky`) shares the same texture-id space as
materials and sprites, but is uploaded once, right after the initial world
load (`WasmRenderer.uploadSky()`), and set with a dedicated
`raycaster_set_sky(textureId)` call (`-1` selects the flat-colour
fallback) rather than going through a per-frame record.

The native render loop contains no JavaScript callbacks or per-pixel WASM calls.

Runtime cell changes use targeted updates through `updateCell`, so cell mutation does not require re-uploading the entire map.

## Frame Flow

```text
Raycaster.renderSnapshot(camera)
    |
    +-- update camera/frame buffers
    +-- one native render call
    +-- C++ raycasts and draws walls
    +-- copy WASM RGBA framebuffer through HEAPU8
    +-- existing Phaser BitmapData upload
```

## Validation

The current implementation has been validated with:

- Successful Emscripten build.
- 35 Raycaster geometry tests (JS reference renderer, untouched).
- WASM adapter fallback contract test.
- Session and lifecycle tests.
- 7 deterministic JavaScript/WASM render-parity tests
  (`tests/wasm-render-parity.test.mjs`), run through the real
  `Raycaster`/`WasmRenderer`/`RaycasterRenderer.wasm` path under Node (a
  `fetch` shim feeds the real `.wasm` bytes to the Emscripten loader, since
  Node's `fetch` doesn't resolve `file:` URLs).

Findings from the deterministic comparisons:

- An unlit corridor scene with wall + floor + ceiling materials produces
  **pixel-identical** output between JS and WASM (0 of 4800 pixels differ),
  including the exact center wall/floor/ceiling pixel values.
- A windowed boundary (sill + lintel with an open gap, revealing a second
  wall through the gap) is also pixel-identical -- multi-segment traversal
  and section caps agree exactly with the JS reference.
- Lit + fogged scenes agree everywhere except the same handful (~9 out of
  4800, ~0.2%) of boundary pixels described below; the lighting/fog
  *formulas* themselves introduce no additional divergence (worst
  non-boundary channel difference: 1/255).
- Billboard sprites (including two sprites at different depths/lateral
  offsets) reproduce that same ~9-pixel baseline and no more, once the
  scene avoids placing a sprite at the exact same forward depth as a wall
  (a genuine depth-test tie that float32 and double round differently --
  not a formula bug; see the test file's comments).
- Oriented sprites (two angled sprites plus a billboard, sharing the same
  depth-sorted draw order) also land on that same ~9-pixel baseline --
  the perspective-correct edge interpolation (rewritten to divide once per
  sprite rather than twice per column, see below) introduced no additional
  divergence.
- A panoramic sky, in a scene where an open ceiling actually reveals it, is
  **pixel-identical** (0 mismatches) -- sky sampling involves no per-pixel
  wall/plane row-boundary rounding, so this is an exact match rather than
  landing on the ~9-pixel baseline the other scenes do.
- The small, consistent handful of differing pixels sit exactly on a wall/
  ceiling row boundary, where `float32` (C++) vs `double` (JS) trigonometry
  rounds an on-the-line projected row to a different integer -- e.g. row
  12.000000 vs 11.999998, flipping which surface that one row belongs to.
  This is the same class of difference the original wall-only prototype
  recorded (764 vs 766 wall pixels in a corridor test); it has not grown
  with the added floor/ceiling/sprite code and is not expected to.

## Performance

`npm run benchmark:raycaster` (`tools/benchmark-raycaster.mjs`) drives both
renderers, under Node, through a 16x10 level exercising every feature both
sides now share (variable wall/floor/ceiling heights, a windowed boundary,
fog, a panoramic sky, lighting, and both billboard and oriented sprites),
sweeping the camera on a fixed sine/cosine path (no `Math.random`, so
results are reproducible) for 500 measured frames after a 30-frame warm-up.
It reports avg/min/p50/p95/p99/max/stddev for the JS renderer's total
`renderSnapshot()` time, and, on the WASM side, three separate stages: the
JS-side camera/sprite/light buffer packing, the native
`raycaster_render_snapshot()` call itself, and the framebuffer-to-`imageData`
copy -- plus their sum, for a fair total-to-total comparison.

Two representative runs on the development machine (240x135 render
target, one point light, six sprites):

```text
SoftwareRenderer (JS) total  avg=1.90ms p50=2.37ms p95=3.82ms p99=5.16ms max=6.09ms
WASM adapter pack (JS)       avg=0.002ms
WASM native render (C++)     avg=0.33ms p50=0.45ms p95=0.68ms p99=0.75ms max=0.83ms
WASM framebuffer transfer    avg=0.003ms
WASM total                   avg=0.34ms p50=0.46ms p95=0.68ms p99=0.75ms max=0.84ms

WASM total avg is ~5.6x the JS avg; p99 ratio is ~6.9-7.2x (worst-frame-time comparison).
```

Findings:

- WASM is not just faster on average -- it is **more consistent**: its
  stddev/avg ratio is comparable to JS's, but its absolute worst-frame
  time (p99/max) sits at roughly a sixth to a seventh of JS's, in this
  scene. That's a direct answer to the migration's original motivation
  (occasional frame-time spikes in the JS renderer): the same
  scene-dependent variance exists in both (both distributions are
  bimodal -- cheap frames looking down the open sky corridor, expensive
  frames looking into a detailed room), but WASM's worst case is still
  far below JS's average.
- The JS-side adapter overhead (packing the camera/sprite/light buffers)
  and the framebuffer transfer are both negligible (microseconds, roughly
  1% of native render time combined) -- essentially all of the WASM path's
  cost is the native render itself, not JS/WASM boundary crossing.
- This does **not** include the browser-side Phaser
  `BitmapData.putImageData()` upload, which is identical for both render
  paths (the same `imageData` buffer flows through it either way) and
  can't be measured meaningfully under Node's fake canvas -- it would add
  an equal constant to both sides, not change the comparison.
- Allocation/GC-pause profiling was intentionally not attempted: Node's
  heap statistics reflect neither the JS engine's real allocator/GC
  behaviour nor the WASM module's linear memory, so a number here would be
  misleading rather than informative. A real investigation of that
  specific question needs a browser memory profiler, not a Node script.
- These are single-machine, single-run-shape numbers, not a
  statistically rigorous benchmark suite -- treat the ~5-7x figures as "a
  large, reproducible, and consistent win in this environment," not a
  universal constant. Re-run `npm run benchmark:raycaster` on the actual
  target hardware/browser before relying on a specific ratio.

## Outstanding Work

Completed since the original wall-only prototype:

1. ~~Compare and tighten wall behavior across variable heights, pitch, FOV,
   lighting, and fog~~ -- done; walls now use the same multi-segment/
   visible-interval traversal as the JS reference, not a single-hit
   shortcut.
2. ~~Port floors and ceilings~~ -- done, including section caps.
3. ~~Port depth-aware billboard sprites~~ -- done, including lazy sprite
   texture-id resolution (`WasmRenderer.resolveSpriteTextureId()`), which
   didn't exist before (sprites carry a string `texture` key, never a
   numeric id, in the real game data model).
4. ~~Port oriented sprites~~ -- done
   (`renderOrientedSprite()`/`getSpriteCameraSpace()` in
   `RaycasterRenderer.cpp`). Per the migration brief's request to inspect
   this path for pathological cost once it's correct: the per-column loop
   in `SoftwareRenderer.js` divides by `leftCamera.depth`/
   `rightCamera.depth` on every column (two divisions x sprite width in
   pixels); the C++ port instead computes `invLeftDepth`/`invRightDepth`
   once per sprite and reuses the per-column `depth` it already has to
   turn the texture-U division into a multiply, so the hot loop is down to
   one division per column (for `depth` itself) instead of three. Also
   factored the light/fog/alpha blend that billboards and oriented sprites
   both do per pixel into one shared `drawSpritePixel()`/`SpriteBlend`
   instead of duplicating it -- same arithmetic, less code to keep in
   sync. Both changes are pure restructuring; the parity tests (run before
   and after) show no behavioural change.

5. ~~Port a textured/panoramic `level.sky`~~ -- done
   (`fillTexturedSky()`/`raycaster_set_sky()` in `RaycasterRenderer.cpp`,
   `WasmRenderer.uploadSky()`). Pixel-identical with the JS reference in
   the deterministic comparison (no lighting/fog/depth-test rounding is
   involved in sky sampling, unlike walls/planes/sprites).
6. ~~Benchmark average frame time, worst/percentile frame time, JS adapter
   overhead, framebuffer transfer cost~~ -- done, see "Performance" above
   (`tools/benchmark-raycaster.mjs`). Allocation profiling specifically was
   evaluated and deliberately not attempted under Node -- see that
   section's explanation.

Remaining, by design (not blocking, low priority per the migration brief):

7. Debug wireframe rendering (`renderDebugWireframes()`) remains
   JavaScript-only. It has no bearing on the actual rendered game view
   (it draws caller-supplied collision wireframes with no depth test or
   texture, straight on top of the frame) and the migration brief
   explicitly deprioritizes it; there's no correctness or performance
   reason to move it.

   **Fixed regression:** staying JS-only doesn't mean "only works when
   `renderer` defaults to JS" -- once real gameplay sessions opted into
   `renderer: "wasm"` (`MapWorld.js`), `WasmRenderer.renderSnapshot()` had
   no debug-overlay step at all, so sprite-anchor crosshairs and
   collision-cylinder wireframes silently stopped appearing even though
   `debugSpriteAnchors`/`CollisionSystem.debug`/`camera.debugObjects` were
   all still correctly wired. `WasmRenderer.drawDebugOverlays()` now draws
   both straight onto the WASM-rendered framebuffer via `fallback` (the
   real `SoftwareRenderer` instance every `Raycaster` already constructs
   alongside `WasmRenderer`), reusing its projection code exactly --
   `SoftwareRenderer.renderSpriteAnchors()` is a new, small extraction of
   the anchor-marker logic already inline in
   `renderBillboard()`/`renderOrientedSprite()`, and
   `renderDebugWireframes()` itself is called unchanged. Both no-op
   immediately (no `updateProjection()` call, which otherwise allocates a
   `Float64Array` every call, and no draw) when neither flag/list has
   anything to show, so this costs nothing in the common case. Verified
   pixel-identical against the JS reference
   (`tests/wasm-render-parity.test.mjs`'s `testDebugOverlays`).

At this point the WASM renderer covers every feature in the migration
brief's checklist (walls with variable heights/pitch/FOV/lighting/fog,
floors, ceilings, both sprite kinds, and sky) with verified pixel-level
parity against the JS reference, and a measured, consistent, large
(~5-7x in the benchmarked scene) performance advantage with negligible
JS/WASM boundary overhead. `SoftwareRenderer.js` should remain available
as the fallback, debugging reference, and parity oracle regardless.
