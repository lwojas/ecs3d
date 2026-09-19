# Raycaster WebGL2 Renderer

This document summarizes the third Raycaster renderer backend, alongside
the JS reference (`SoftwareRenderer.js`) and the C++/WASM port
(`WasmRenderer.js`, see [`wasm-renderer-readme.md`](wasm-renderer-readme.md)).

## Motivation

The JS and WASM renderers are both CPU-bound: every frame, they DDA-trace
one ray per screen column and hand-rasterise walls/planes/sprites into a
CPU pixel buffer (WASM is ~5-7x faster than JS in this repo's benchmark, but
still 100% CPU). The WebGL renderer exists for low-power, GPU-capable
hardware (Chromebooks) where even the WASM path may not leave enough CPU
headroom for gameplay/AI/other systems, by moving rasterisation, texturing,
and per-pixel lighting/fog onto the GPU.

## Architecture

```text
Game systems
    |
    v
Raycaster.js
(public API, resources, Phaser sprite/texture wiring)
    |
    +-- SoftwareRenderer.js  -- JS reference and fallback renderer
    +-- WasmRenderer.js      -- C++/WASM renderer adapter
    +-- WebGLRenderer.js     -- WebGL2 renderer
```

Selected via the same constructor option as WASM:

```js
new Raycaster(game, level, { renderer: "webgl" });
```

Unlike the other two, **WebGLRenderer does not ray-trace at all.** The
level's cell grid is a uniform Wolfenstein/Doom-style grid, so rather than
re-deriving per-column screen-space quads every frame (mimicking the CPU
approach on the GPU), `buildGeometryBatches()` builds a real, static 3D mesh
once — one quad per wall-section face (+ section caps, matching
`drawSectionCaps()`'s neighbour logic), one quad per cell floor/ceiling —
grouped into one GPU buffer per distinct material (batched by object
identity, not by cell or column, so a whole level draws in a handful of
draw calls regardless of map size). That mesh is rendered every frame with
a standard perspective camera; the GPU rasteriser and a real depth buffer
resolve visibility, replacing the CPU's manual `pixelDepth`/visible-interval
bookkeeping entirely.

The mesh is rebuilt (not patched) whenever a cell mutates
(`setCellSections`/`setCellBlocking` — doors), and whenever the world loads.
Cost is proportional to map size, not frame rate.

### Renderer contract

`Raycaster.js` only ever calls `renderSnapshot()`, `updateWorldFromState()`,
`updateCellFromState()`, and `destroy()` on this renderer directly. Every
other method it needs (`createRay`, `traceRay`, `checkVisibility` support,
`resolveLights`, `getFogBlend`, `projectBillboard`, ...) is delegated
through `this.fallback` — a real `SoftwareRenderer` instance — exactly like
`WasmRenderer` already does. `WebGLRenderer` never reimplements those; it
only draws pixels and manages GPU resources. This means `castRay`,
`checkVisibility`, `getStandingHeightWorld`, and all AI/collision queries
are completely unaffected by which renderer is drawing pixels.

### Camera projection

`camera.pitch` remains a screen-space pixel shear (not a real pitch
rotation — see [`raycaster-api.md`](raycaster-api.md)), matching the other
two renderers exactly. The view/projection matrix (`buildViewProjection()`
in `WebGLRenderer.js`) is derived algebraically from the existing
`projectWorldZ`/`projectLateralToScreenX`/`computeFocalLength` formulas, so
FOV, wall projection, and the pitch-shear "look up/down" behaviour are
unchanged — only expressed as a matrix instead of a per-pixel formula. See
that file's header comment for the full derivation.

### Display integration (the one change to `Raycaster.js`)

The JS/WASM renderers both write into a shared CPU `imageData` buffer that
gets blitted into a Phaser `BitmapData` via `putImageData()` every frame.
Reading pixels back from the GPU (`gl.readPixels`) just to hand them to that
same path would be exactly the CPU↔GPU synchronisation stall this renderer
exists to avoid. Instead, `WebGLRenderer` owns its own `<canvas>`/`gl`
context, and `Raycaster.js` displays that canvas directly via
`PIXI.Texture.fromCanvas(...)` for the `webgl` branch only — the game here
runs Phaser in pure Canvas2D mode (`Phaser.CANVAS`, see `scripts/init.js`),
so Phaser's `CanvasRenderer` draws a canvas-backed texture with a live
`context.drawImage(sourceCanvas, ...)` every frame, no extra upload step.
No public constructor option, camera contract, or method signature changed.

### Deliberate visual deviations from the CPU renderers

- **Per-pixel lighting/fog on every surface, including walls.** The CPU
  renderers resolve lighting per-column for walls (a granularity trick to
  make it affordable on CPU); a GPU fragment shader gets true per-pixel
  lighting on every surface for the same cost, so reproducing the coarser
  CPU tiers would be pointless. Fog uses real Euclidean distance to the
  camera rather than the CPU's projected/perpendicular-distance
  approximation, for the same reason (real per-pixel world position removes
  the need for that approximation).
- **A real depth buffer.** Floors/ceilings now correctly occlude sprites
  behind them — the CPU's `pixelDepth` design explicitly does not do this
  (a documented simplification, not a feature being removed).
- **All four side faces are emitted for every solid cell**, even ones
  bordering another solid neighbour (an interior face the camera can never
  reach). Reasoning about which faces are externally visible would need the
  same neighbour-gap interval logic `subtractInterval()`/`drawSectionCaps()`
  already do on the CPU side; for this engine's modest, mostly
  single-cell-thick levels, the extra hidden triangles are a bounded, minor
  cost, not worth the complexity yet.

## Files

- `scripts/system/WebGLRenderer.js` — the renderer: GL context/shader setup,
  `buildGeometryBatches()` (pure, gl-free mesh building — unit-testable
  under Node), per-material texture cache, camera/light uniform upload,
  sky/geometry/sprite/debug-line draw passes.
- `scripts/system/Raycaster.js` — constructor renderer-selection branch +
  the `renderSnapshot()` display-path branch described above. No other
  changes.
- `tests/webgl-renderer-contract.test.mjs` — Node-runnable: pure
  `buildGeometryBatches()` unit tests (exact vertex/cap counts against
  hand-built levels), the graceful-fallback contract when WebGL2 is
  unavailable (mirrors `tests/wasm-renderer-contract.test.mjs`), a full
  lifecycle test against a mock WebGL2 context, and renderer-selection
  tests through the real `new Raycaster(...)` API.
- `tools/benchmark-raycaster.html` — browser-only JS/WASM/WebGL frame-time
  comparison (see "Benchmarking" below).

## Testing

```sh
npm run test:webgl-contract
```

There is no headless WebGL context available under Node (the existing
benchmark/tests already run entirely under a fake DOM — see
`wasm-renderer-readme.md`), and no native headless-GL dependency was added
to get one. What's covered under Node:

- `buildGeometryBatches()` against hand-built levels (exact vertex counts,
  material batching by object identity, per-vertex fog, section-cap
  generation) — this is the part of the renderer that's actually pure data
  transformation, so it's fully testable without a GPU.
- The graceful-degradation contract (falls back to `SoftwareRenderer`
  when WebGL2 is unavailable, never throws) and the full render/mutate/
  destroy lifecycle, both against a hand-written mock WebGL2 context that
  records calls instead of touching a real GPU — enough to catch a wrong
  argument, a missing uniform, or a crash, but **not** whether a single
  pixel is the right colour.

Actual visual correctness (textures, lighting, fog, sky, sprite placement,
doors) needs a real browser: run `npm start`, and check both
`renderer: "wasm"` (regression — should be pixel-for-pixel unaffected by
this work) and `renderer: "webgl"` (set in
`scripts/api/session/MapWorld.js`'s `createDefaultRaycaster()`).

## Benchmarking

`tools/benchmark-raycaster.html`, opened in a browser via `npm start`
(not `file://`, so the WASM module's relative fetch resolves), reuses the
same scene/camera-sweep shape as `tools/benchmark-raycaster.mjs`
(`buildBenchmarkLevel()`/`buildSprites()`/`cameraForFrame()`) and drives
JS, WASM, and WebGL back to back at the same internal resolution, reporting
avg/p50/p95/p99/max frame time for each. This is necessarily manual and
browser-run — there is no real GPU under Node. Run it on the actual
low-power target hardware before drawing conclusions from any ratio it
reports; it prints the same "single-machine, not a rigorous suite" caveat
the Node benchmark already does.

### A pre-existing, unrelated gap found while checking for regressions

`WasmRenderer` has no `debugStats` object of its own. `Raycaster.renderSnapshot()`
unconditionally writes `this.renderer.debugStats.uploadMs = ...` when
`this.debug` is true, which throws for the `wasm` renderer whenever `debug`
is left at its default (`true`) instead of explicitly set to `false` (as
real gameplay code does in `MapWorld.js`). This reproduces on an unmodified
checkout — confirmed via `git stash` — so it predates and is unrelated to
this WebGL work; `tests/wasm-render-parity.test.mjs` and
`npm run benchmark:raycaster` both hit it today. `WebGLRenderer` gives
itself a real `debugStats` object specifically to not share this gap (see
its constructor comment), and `tools/benchmark-raycaster.html` passes
`debug: false` explicitly to route around it for the WASM side. Not fixed
here — it's a `WasmRenderer.js` bug, out of scope for this renderer.

## Outstanding work (by design, not blocking)

1. **Texture atlas/array batching.** Materials are currently batched by
   object identity only (one draw call per distinct texture actually used
   this frame) — simple and already far from the "thousands of draw calls"
   failure mode for any real map, but a texture array would collapse
   opaque geometry to one draw call regardless of material count. Deferred
   until profiling on real hardware shows texture-bind overhead actually
   matters.
2. **Per-cell mesh patching.** `updateCellFromState()` rebuilds the whole
   mesh rather than patching just the mutated cell's geometry. Fine for
   occasional door toggles at this engine's map sizes; would need
   revisiting if a level ever animates many doors continuously every frame.
3. **Debug wireframe/sprite-anchor overlays** are implemented (as native
   `gl.LINES`, reusing the same view/projection matrix — see
   `drawDebugWireframes()`) but are a lower priority than the core
   rendering requirements and have not been exercised in a real browser.
