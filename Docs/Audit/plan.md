# Raycaster Engine Incremental Development Plan

This plan translates the goals in [readme.md](readme.md) into small, verifiable changes that preserve the current Phaser 2 codebase and avoid large renderer rewrites.

Each section has a stable identifier. Use these IDs when referring to work in future prompts.

## Current Architecture Assessment

The current renderer already has a useful foundation:

- A low-resolution CPU framebuffer uploaded to a Phaser 2 `BitmapData` texture.
- Grid-based DDA traversal.
- Data-driven cell heights and surfaces.
- One DDA traversal per screen column.
- Separate ray segments containing entry and exit distances.
- Fisheye-corrected wall projection.
- Plane rendering that uses actual ray distances for world intersections.
- Interval-based column visibility for partial wall occlusion.
- Cached column geometry, sky pixels, and reusable ray segment objects.

The main architectural limitations are not urgent correctness problems. They are boundaries that should be improved gradually:

1. The renderer still accepts a Phaser game object and a level object directly.
2. Cell lookup and renderer-owned cell preparation are coupled to the source level format.
3. Visibility is currently local to a column and is not exposed as reusable depth information.
4. Materials are loaded and represented as surface objects attached directly to cells.
5. Camera state is represented through a player-shaped object rather than a renderer-facing camera structure.
6. The current plane implementation remains the most expensive rendering path.
7. Wall geometry is still implicitly derived from the cell's complete floor-to-ceiling interval.

The implementation strategy should preserve the current renderer while introducing narrow seams around these areas.

---

## P0 — Baseline and Safety

### P0-01 — Add a Lightweight Debug Mode

Add optional, disabled-by-default diagnostics without changing normal rendering.

Useful diagnostics:

- Number of traced segments per column.
- Number of wall pixels drawn.
- Number of plane pixels tested and drawn.
- Number of visible intervals per column.
- Frame time for traversal, geometry, planes, walls, and texture upload.

Implementation guidance:

- Use an option such as `debug: false`.
- Avoid logging inside inner loops unless explicitly enabled.
- Prefer counters accumulated during a frame and printed once.

Acceptance criteria:

- Normal rendering has no per-frame console output.
- Profiling can identify the dominant stage of a frame.

---

## P1 — Stabilise the Renderer-Facing Data Boundary

### P1-01 — Introduce a Plain Camera Snapshot

Add a small adapter or helper that converts the current player object into plain camera data:

```js
{
  (x, y, z, angle, pitch, fov);
}
```

Initial compatibility rules:

- `x`, `y`, and `angle` come from the current player.
- `z` defaults to the current `cameraHeight`.
- `pitch` defaults to `0`.
- `fov` defaults to the raycaster FOV.
- The existing `render(player)` method may remain temporarily as a compatibility wrapper.

Do not move player movement, collision, or input logic into the renderer.

Acceptance criteria:

- Rendering can consume camera values without depending on player methods or components.
- Existing callers continue to work.

### P1-02 — Add a Compatibility Render Entry Point

Add a renderer-facing method such as `renderSnapshot(snapshot)` while preserving `render(player)`.

Suggested transition:

```text
render(player)
    -> buildCameraSnapshot(player)
    -> renderSnapshot(snapshot)
```

At this stage, the snapshot can still contain the existing level reference. The goal is only to establish the API seam without changing world behaviour.

Acceptance criteria:

- Existing game code requires no immediate migration.
- New code can render from plain data.

### P1-03 — Isolate Level Normalisation

Move the conversion from raw level definitions to renderer-ready cells behind a dedicated normalisation step.

The normalised cell should continue to support:

- `floorHeight`
- `ceilingHeight`
- `wall`
- `floor`
- `ceiling`

Do not change the level file format yet. Do not introduce sectors or portals at this stage.

Acceptance criteria:

- Rendering code does not need to know whether the source map uses strings or arrays.
- The current `3dtestLevel.js` renders identically.

---

## P2 — Materials Without Breaking Cells

### P2-01 — Add a Material Cache

Create a renderer-local material cache keyed by texture key and physical texture dimensions.

The cache should store the CPU-readable pixel data currently produced by `loadSurface()`.

Suggested cache key:

```text
textureKey + ":" + worldWidth + ":" + worldHeight
```

Tasks:

- Reuse decoded pixel data when multiple cells reference the same texture and scale.
- Keep surface objects immutable after loading.
- Preserve the current cell fields during migration.

Acceptance criteria:

- Repeated floor, wall, and ceiling definitions do not duplicate image data unnecessarily.
- Existing texture mapping remains unchanged.

### P2-02 — Separate Surface Identity from Cell Geometry

Add optional material references internally while retaining the existing surface fields as a compatibility input.

Migration order:

1. Accept existing inline surfaces.
2. Resolve them into cached material objects.
3. Keep `cell.wall`, `cell.floor`, and `cell.ceiling` available to current rendering code.
4. Only later consider changing level files to named materials.

Do not require a level format migration until the renderer can support both forms.

Acceptance criteria:

- Materials can be reused independently of cells.
- Existing level data requires no edits.

---

## P3 — Geometry and Visibility Improvements

### P3-01 — Make Segment Geometry Explicit

Keep `traceRay()` as the only DDA traversal for a column, but formalise the segment data shape.

Each segment should contain:

```js
{
  (mapX,
    mapY,
    cell,
    entryDistance,
    exitDistance,
    entrySide,
    entryHitX,
    entryHitY,
    dirX,
    dirY);
}
```

Add comments or a small constructor/helper only if it improves readability. Avoid introducing a class for every segment.

Acceptance criteria:

- DDA traversal remains separate from drawing.
- Wall and plane code consume the same segment information.
- Entry and exit distances cannot be confused by naming.

### P3-02 — Add a Per-Column Depth Buffer

After the existing interval clipping is stable, expose a simple depth buffer for the nearest opaque wall or surface at each screen column.

Suggested initial data:

```js
this.columnDepth = new Float32Array(this.width);
```

Initial use:

- Store the nearest fully occluding wall distance.
- Use it for diagnostics and future sprite clipping.
- Do not immediately replace interval clipping with the depth buffer because a single depth value cannot represent all vertical openings.

Acceptance criteria:

- The depth buffer is updated during rendering.
- Existing variable-height visibility remains controlled by intervals.
- No sprite system is required yet.

### P3-03 — Extract Column Visibility Helpers

Keep the current interval algorithm, but isolate it from wall and plane drawing.

Candidate helpers:

- `createVisibleIntervals()`
- `clipSurfaceToVisibleIntervals()`
- `subtractInterval()`
- `isYVisible()`

The helpers should operate on simple arrays or typed-array-backed data later. Do not optimise the representation before profiling.

Acceptance criteria:

- Wall and plane rendering do not each implement their own clipping rules.
- Short walls can leave upper and lower visible windows.

### P3-04 — Make Horizontal Plane Projection a Standalone Stage

Keep the existing mathematical distinction:

- Actual ray distance determines the world intersection.
- Corrected distance determines projected screen position.

Refactor only for naming and testability:

- `projectPlaneBoundary()` determines the projected range for a segment.
- `getPlaneDistanceAtScreenY()` determines actual ray distance for a screen row.
- `drawPlanePixel()` only maps a world position to a texture pixel.

Do not reintroduce DDA inside plane rendering.

Acceptance criteria:

- Floors and ceilings remain segment-owned.
- No sky leaks through a textured plane boundary.
- The plane code can be tested with synthetic segment data.

---

## P4 — Targeted Performance Work

### P4-01 — Profile Before Optimising Further

Use the debug counters and browser performance tools to confirm the dominant cost.

Measure separately:

- Ray setup and DDA traversal.
- Segment object reuse.
- Wall pixel loops.
- Plane pixel loops.
- Visibility checks.
- Texture upload through `putImageData()`.
- Phaser sprite scaling/display overhead.

Acceptance criteria:

- Optimisations are tied to measured costs.
- Correctness changes are not justified only by assumptions about performance.

### P4-02 — Replace Per-Pixel Plane Division With Incremental Distances

If profiling confirms plane projection is dominant, replace repeated division in `getPlaneDistanceAtScreenY()` with an incremental row traversal.

The projected plane relation is hyperbolic, so the implementation should not use a naive linear interpolation of world positions. A safe incremental approach is:

1. Compute the first visible screen row and its ray distance.
2. Advance rows using a mathematically equivalent recurrence or a small lookup table.
3. Validate every computed distance against the segment entry and exit distances.

Keep the existing division-based implementation available behind a debug or fallback path during development.

Acceptance criteria:

- Plane rendering is measurably faster.
- Texture coordinates remain visually stable at cell boundaries.
- No regression for raised floors or optional ceilings.

### P4-03 — Cache Plane Projection Constants

Cache values that are invariant during a frame or renderer configuration:

- `focalLength`.
- Inverse ray cosine per column.
- Screen-row offsets from the horizon.
- Common material texture scale factors.

Invalidate caches when width, height, FOV, or camera projection settings change.

Acceptance criteria:

- No stale values after resize or FOV changes.
- The cache reduces arithmetic in the inner loops without obscuring the geometry.

### P4-04 — Reduce Visibility Representation Overhead

Only after profiling should the array-of-object interval representation be replaced.

Potential incremental representation:

```js
{
  (top0, bottom0, top1, bottom1);
}
```

This is sufficient for the current renderer because a small number of intervals is normally produced per column. Avoid a general-purpose interval tree.

Acceptance criteria:

- Fewer allocations occur in `renderColumn()`.
- The two-window short-wall case remains correct.
- The code remains understandable.

### P4-05 — Evaluate Framebuffer Upload Cost

Measure whether `texture.context.putImageData()` is a significant portion of frame time.

Possible later experiments:

- Keep the current upload path as the default.
- Compare a direct Phaser bitmap data update if available in the current Phaser build.
- Test a smaller internal framebuffer only if visual quality remains acceptable.

Do not introduce WebGL or workers solely to solve an unmeasured cost.

---

## P5 — Camera Features

### P5-01 — Move Camera Z Into the Snapshot

Use `camera.z` as the source of camera height while keeping the current default for compatibility.

Migration rule:

```js
camera.z ?? raycaster.cameraHeight;
```

The renderer must not decide how jumping, crouching, gravity, or step-up movement works.

Acceptance criteria:

- Camera height can change per frame from external state.
- Existing player behaviour remains unchanged when `z` is omitted.

### P5-02 — Add Pitch as a Projection Offset

Implement pitch as a screen-space horizon offset after the vertical world-Z projection is correct.

Suggested model:

```text
screenY = projectedWorldY + pitchOffset
```

Do not alter DDA or world plane intersections for pitch.

Acceptance criteria:

- Looking up/down does not change ray traversal.
- Walls, floors, ceilings, and future sprites use the same horizon offset.
- Zero pitch reproduces current output.

### P5-03 — Make FOV Changes Explicitly Rebuild Column Caches

When camera FOV changes:

- Rebuild `columnGeometry`.
- Recompute focal length if the projection model requires it.
- Preserve the existing FOV when no camera override is provided.

Acceptance criteria:

- Runtime FOV changes are correct.
- Cached ray directions never use stale FOV data.

---

## P6 — Depth-Aware Objects

### P6-01 — Define Raw Sprite Render Data

Add a renderer-facing sprite structure without connecting it to ECS components yet:

```js
{
  (x, y, z, texture, width, height, frame);
}
```

The renderer should only consume this data. It must not know whether the source object is an enemy, pickup, weapon, or decoration.

### P6-02 — Implement Billboard Projection Separately

Create a separate sprite projection stage after walls and planes are stable.

Responsibilities:

- Transform world position into camera-relative coordinates.
- Project position and dimensions.
- Sort sprites back-to-front or use distance ordering.
- Clip against the framebuffer.

Do not mix sprite code into DDA or wall segment extraction.

### P6-03 — Use Column Visibility/Depth for Sprite Occlusion

Initially use the wall depth and visible interval information conservatively.

Later, add a per-column/per-row depth representation only if simple wall depth is insufficient for raised floors, windows, or partial walls.

Acceptance criteria:

- Sprites behind opaque walls are hidden.
- Sprites visible through partial openings remain visible where geometry permits.

---

## P7 — Geometry Evolution

### P7-01 — Preserve Cells While Adding Edge Descriptors

Do not replace the cell format immediately. Add optional edge data alongside the current cell fields:

```js
edges: {
  north: {...},
  east: {...},
  south: {...},
  west: {...}
}
```

The current wall surface remains the fallback for all edges.

Acceptance criteria:

- Existing maps continue to work unchanged.
- A single cell can eventually have different wall materials or openings per edge.

### P7-02 — Introduce Wall Openings as Explicit Intervals

When doors or windows are needed, represent an edge as one or more vertical intervals rather than adding special cases to `drawWall()`.

Conceptually:

```js
{
  bottom: 0,
  top: 1,
  material: "wall"
}
```

A door can then change its open/closed interval through render data without changing DDA.

Acceptance criteria:

- DDA still answers which grid boundary was crossed.
- Geometry extraction answers which vertical intervals exist there.
- Rendering can draw multiple wall intervals at one boundary.

### P7-03 — Evaluate Sector/Portal Data Only After Edge Geometry Is Used

Do not introduce sectors, portals, or non-grid topology until edge descriptors and openings demonstrate that the current grid model is insufficient.

If sectors become necessary, add them as a second world representation or adapter rather than rewriting the current map loader immediately.

---

## P8 — Lighting, Fog, and Sky

### P8-01 — Add Distance Fog as a Post-Sample Colour Operation

Implement fog after a texture colour is selected, using distance already available from wall or plane projection.

Keep the initial model simple:

```text
finalColour = mix(surfaceColour, fogColour, fogAmount)
```

Do not couple fog to gameplay visibility or collision.

### P8-02 — Add Ambient and Surface Lighting

Introduce lighting as renderer configuration or render-snapshot data.

Suggested order:

1. Global ambient multiplier.
2. Distance attenuation.
3. Per-cell or per-surface brightness.
4. Dynamic lights only after the previous stages are stable.

Keep lighting calculations separate from texture lookup.

### P8-03 — Generalise Sky Input

Preserve the current flat sky colour as the default. Later allow a sky configuration object:

```js
{
  (color, texture, mode);
}
```

`ceiling: null` must continue to mean that the sky is exposed rather than creating an implicit ceiling surface.

---

## P9 — ECS Adapter and Render Snapshot

### P9-01 — Create a Thin Render Adapter

Build an application-side adapter that produces the plain renderer snapshot.

Responsibilities:

- Read camera-related components.
- Read world/cell data.
- Read sprite data when available.
- Copy only renderer-relevant values.
- Avoid passing ECS entities or component instances into the renderer.

The adapter should be outside the raycaster module.

### P9-02 — Keep the Snapshot Serializable

Prefer plain objects, arrays, numbers, strings, and typed arrays where justified.

Avoid passing:

- Phaser sprites.
- DOM objects.
- Entity references.
- Functions.
- Circular structures.

This keeps recording, replay, testing, worker experiments, and a future WASM boundary practical.

### P9-03 — Migrate Callers Gradually

Migration order:

1. Existing `render(player)` wrapper remains.
2. Add snapshot construction beside the current call site.
3. Compare old and snapshot rendering.
4. Switch the game state to `renderSnapshot(snapshot)`.
5. Remove the compatibility wrapper only after all callers are migrated.

---

## P10 — Testing and Regression Strategy

### P10-01 — Add Pure Geometry Tests

Test functions that do not require Phaser or a DOM canvas:

- `projectWorldZ()`.
- `getCorrectedDistance()`.
- `createRay()`.
- `stepRay()`.
- `traceRay()`.
- Plane distance calculations.
- Interval subtraction.

Use deterministic numeric inputs and tolerances for floating-point comparisons.

### P10-02 — Add Segment Fixtures

Create small synthetic maps for:

- One open cell and one wall.
- Height 8 wall.
- Height 16 wall.
- Raised floor and short wall.
- Different adjacent floor heights.
- Different adjacent ceiling heights.
- Open ceiling.
- Multiple corridor cells.

These fixtures should validate geometry independently from texture appearance.

### P10-03 — Add Screenshot Regression Cases

Keep a small set of fixed camera snapshots and compare rendered output manually at first.

Automated pixel thresholds can be added later, but avoid making minor browser or texture decoding differences fail the entire project prematurely.

### P10-04 — Add Performance Benchmarks

Measure a fixed number of renders for representative scenes:

- Empty/open corridor.
- Many short segments.
- Many visible floors and ceilings.
- Tall and short geometry mixed together.

Track frame time and allocations where browser tooling allows it.

---

## Recommended Implementation Order

The safest order is:

1. P0-01 — Capture the current baseline.
2. P0-02 — Add optional diagnostics.
3. P1-01 — Introduce a plain camera snapshot.
4. P1-02 — Add `renderSnapshot()` while preserving `render(player)`.
5. P1-03 — Isolate level normalisation.
6. P2-01 — Add material caching.
7. P3-01 — Formalise segment geometry.
8. P3-02 — Add a diagnostic depth buffer.
9. P3-03 — Extract visibility helpers.
10. P3-04 — Isolate plane projection.
11. P4-01 — Profile the new boundaries.
12. P4-02 through P4-05 — Apply only measured performance changes.
13. P5 — Add camera Z, pitch, and runtime FOV support.
14. P10 — Expand pure geometry, screenshot, and performance coverage continuously.
15. P6 — Add sprites after depth and visibility are stable.
16. P7 — Add independent edge geometry and openings only when needed.
17. P8 — Add fog, lighting, and generalised sky.
18. P9 — Complete ECS/render-snapshot migration.

---

## Explicit Non-Goals for the Next Refactor

Do not combine these items into the next implementation task:

- A full sector or portal rewrite.
- Replacing the grid map format.
- Moving the renderer to WebAssembly.
- Introducing WebGL or a worker renderer.
- Adding ECS awareness to `Raycaster`.
- Adding sprites, lighting, fog, and doors in one change.
- Replacing all objects with typed arrays before profiling.
- Rewriting the DDA algorithm without a measured correctness or performance reason.

The next implementation should normally target one section ID, include a small regression check, and preserve the existing `render(player)` call path unless the task explicitly targets the render snapshot migration.

---

## Implementation Update — 2026-08-10

### Selected First Refactor: P0-02

The first implementation job was selected as `P0-02 — Add a Lightweight Debug Mode`.

This is the safest first code change because the current renderer is already working and the roadmap explicitly prioritises profiling before further optimisation or architectural change. A diagnostic layer gives the next tasks evidence without changing the render algorithm, level format, public `render(player)` call path, or Phaser integration.

`P0-01 — Capture the Current Rendering Baseline` remains a manual validation step and should be performed before using the new counters to compare later changes.

### Completed Changes

The raycaster now supports an opt-in `debug: true` constructor option and exposes:

- DDA step count.
- Cell segment count.
- Wall segment count.
- Wall pixels processed.
- Plane pixels tested.
- Plane pixels drawn.
- Visibility interval checks.
- Frame time.
- DDA/column-render time.
- Phaser texture upload time.

Optional periodic output can be enabled with `debugLogEvery`, for example once every 60 frames. Debug counters and timers are disabled by default, so the normal render path does not perform diagnostic work.

### Validation

- Existing level data was not changed.
- Existing `render(player)` usage was preserved.
- The DDA, projection, clipping, and texture algorithms were not rewritten.
- Editor error checking reported no errors in the raycaster.
- ES-module syntax validation and whitespace validation passed.

### Next Recommended Action

Perform `P0-01` manually using fixed camera positions and record the debug output for:

1. An open corridor.
2. A corridor containing multiple floor and ceiling heights.
3. A view containing cell 3.
4. A view with a tall wall and an optional ceiling.

Then proceed to `P4-01 — Profile Before Optimising Further`. The first optimisation target should be chosen from the measured `planePixelsTested`, `planePixelsDrawn`, `traceMs`, and `uploadMs` values rather than assumed in advance.

### P0-01 Baseline Results

The test scene was run at `320 × 180` with the current `16 × 16` map, `cellSize: 4`, and `maxDistance: 1000`. Diagnostics were enabled temporarily in the test state, four fixed camera views were rendered, and diagnostics were then disabled again.

| View              | DDA steps / segments | Wall segments | Wall pixels | Plane tested | Plane drawn | Visibility checks | Frame time |
| ----------------- | -------------------: | ------------: | ----------: | -----------: | ----------: | ----------------: | ---------: |
| Boundary east     |                4,824 |           819 |      53,966 |       25,219 |      14,598 |            74,840 |     2.6 ms |
| Corridor north    |                1,604 |           435 |      52,091 |       20,176 |       8,640 |            72,267 |     2.5 ms |
| Short-cell area   |                4,071 |         1,105 |      66,466 |       28,282 |       8,640 |            94,433 |     2.1 ms |
| Interior corridor |                4,475 |           320 |      57,600 |            0 |           0 |            57,600 |     1.7 ms |

Observations:

- The short-cell view produces the most wall work and visibility checks.
- Plane tests are significant, but the current measured frame time does not justify an immediate plane algorithm rewrite.
- The interior corridor view has no plane work and is still dominated by wall/visibility processing.
- Texture upload was reported as `0 ms` at this resolution in the browser measurement, so it is not currently the first optimisation target.
- The missing `assets/textures/ceiling.png` warning is an asset issue, not a renderer performance result; the current level references `ceilingTexture` but the file is unavailable.

Next action: continue with `P4-01` using these values as the baseline, then target the visibility and wall hot paths before attempting the more mathematically sensitive plane optimisation in `P4-02`.

### Follow-up Implementation — P4-03 and P4-04 Preparation

The next low-risk optimisation has now been implemented in [scripts/system/Raycaster.js](scripts/system/Raycaster.js):

- Screen-row plane projection factors are precomputed once during construction.
- Plane screen-boundary projection no longer creates temporary projection objects for each segment boundary.
- Per-pixel plane distance lookup reuses the cached row factors.
- Visibility checks use a simple loop instead of allocating an iterator callback through `Array.prototype.some()`.

These changes preserve the existing projection equations and interval representation. They do not change DDA traversal, cell ownership, wall clipping, or texture selection.

The next measured step should be a browser comparison against the baseline table above. If the short-cell view remains dominated by visibility checks, implement `P4-04` with reusable fixed-capacity visibility intervals rather than a general-purpose interval structure. If plane tests remain dominant, proceed with `P4-02` only after comparing the cached implementation against the baseline output.

### Post-change Check

The optimized renderer was reloaded in the browser and checked with the same representative views. Segment, wall, plane, and visibility counts remained consistent with the baseline, confirming that the geometry and clipping work was not altered. Single-frame timings varied between runs, so they are not treated as a statistically meaningful speedup yet.

The current data still points to the visibility/wall path as the next optimisation candidate. The next change should therefore be `P4-04`, implemented with reusable fixed-capacity intervals and no general-purpose allocation-heavy structure.

### P4-04 Completed — Fixed-Capacity Visibility Intervals

Implemented the visibility optimisation in [scripts/system/Raycaster.js](scripts/system/Raycaster.js):

- Each screen column owns one reusable `Float64Array` interval buffer.
- Intervals are stored as numeric `top/bottom` pairs rather than objects.
- `renderColumn()`, `renderPlane()`, `drawWall()`, and visibility checks now pass an explicit interval count.
- `subtractInterval()` mutates the buffer in place for trimming, deletion, and splitting.
- The default capacity is eight intervals per column and can be configured with `visibleIntervalCapacity`.
- The existing interval model is retained; no general-purpose interval tree was introduced.

Validation:

- The browser rendered the boundary, short-cell, and interior-corridor cases without runtime errors.
- DDA, wall, plane, and visibility counts matched the previous baseline exactly.
- A synthetic multi-split interval test produced the expected remaining intervals.
- No editor errors, syntax errors, or whitespace errors were reported.

Single-frame browser timings remain noisy and are not treated as a definitive speedup. The important result for this step is reduced per-frame allocation pressure while preserving the existing visibility behaviour.

Next action: repeat the baseline over a larger sample of frames. If the renderer is stable, proceed to `P2-01` material caching or add a small pure geometry test harness under `P10-01` before attempting another hot-path rewrite.

### P2-01 and P2-02 Completed — Cached Materials With Cell Compatibility

Implemented the first materials refactor in [scripts/system/Raycaster.js](scripts/system/Raycaster.js):

- Added a renderer-local material cache keyed by texture key, world width, and world height.
- Repeated inline surfaces now reuse the same decoded CPU pixel buffer.
- Existing `cell.wall`, `cell.floor`, and `cell.ceiling` fields are unchanged for the renderer.
- Added compatibility for named material references through `level.materials`.
- Inline surface properties override named material properties when both are supplied.
- Added `getMaterialStats()` for cache inspection.
- Cleared cached material references in `destroy()`.

The level format remains backward-compatible. Existing inline definitions continue to work without modification, while future levels may define reusable materials such as:

```js
materials: {
  brick: {
    texture: "brickTexture",
    width: 2,
    height: 1.5
  }
}
```

Validation:

- Browser rendering completed successfully.
- The test scene loaded four material entries with six cache hits and four cache misses.
- Repeated floor surfaces resolved to the same cached material object.
- The existing missing ceiling texture warning remains an asset issue and is unrelated to caching.
- No editor errors, syntax errors, or whitespace errors were reported.

Next action: add a small `P10-01` pure geometry/material test harness before introducing the camera snapshot boundary. This will protect cache key behaviour and interval clipping while the renderer API evolves.

### P10-01 Completed — Pure Geometry and Material Tests

Added [tests/raycaster-geometry.test.mjs](tests/raycaster-geometry.test.mjs) and the `npm run test:raycaster` command.

The harness instantiates the raycaster prototype without Phaser or a DOM canvas and covers:

- World-Z to screen-Y projection.
- Fisheye correction.
- DDA segment ordering, entry/exit distances, entry sides, and wall compatibility lookup.
- Horizontal plane distance and inverse projection calculations.
- Fixed-capacity interval clipping, including split and full removal cases.
- Named material resolution and inline property overrides.

This keeps the tests independent of browser texture loading while protecting the geometry and material contracts introduced by the recent refactors.

Validation:

- All six pure tests pass with `npm run test:raycaster`.
- The test does not modify the existing `npm start` browser workflow.
- No renderer or level-data behaviour was changed by the test harness.

The tests also identified and corrected a metadata issue in `traceRay()`: segment `mapX` and `mapY` were being recorded after the DDA step, even though the segment represented the cell traversed before that step. The renderer already used the captured cell and boundary data, but correcting the coordinates makes the public segment and `castRay()` results internally consistent.

The project package is now explicitly marked as an ES module so Node can import the existing renderer in the test harness. This matches the browser source format already used throughout the project and does not change the `npm start` workflow.

Next action: proceed with `P1-01` by introducing a plain camera snapshot while preserving `render(player)` as the compatibility entry point.

### P1-01 Completed — Plain Camera Snapshot

Added `createCameraSnapshot()` to [scripts/system/Raycaster.js](scripts/system/Raycaster.js) and routed the existing `render(player)` path through the snapshot.

The snapshot contains:

```js
{
  (x, y, z, angle, pitch, fov);
}
```

Compatibility behaviour:

- `x`, `y`, and `angle` are copied from the existing player object.
- `z` defaults to the renderer camera height.
- `pitch` defaults to `0`.
- `fov` defaults to the renderer FOV.
- The current projection still uses the renderer's existing camera-height and FOV configuration; consuming dynamic `z`, `pitch`, or FOV values is intentionally deferred to the later camera steps.
- Player movement, collision, input, and ECS concerns remain outside the renderer.

Added a camera snapshot test to [tests/raycaster-geometry.test.mjs](tests/raycaster-geometry.test.mjs). The next isolated step is `P1-02`, adding `renderSnapshot(snapshot)` while keeping `render(player)` as a compatibility wrapper.

### P1-02 Completed — Snapshot Render Entry Point

Added `renderSnapshot(camera)` to [scripts/system/Raycaster.js](scripts/system/Raycaster.js).

The transition is now:

```text
render(player)
  -> createCameraSnapshot(player)
  -> renderSnapshot(camera)
```

The legacy `render(player)` method remains available to existing game code. The new entry point accepts plain camera data and contains the existing render loop, so no ECS object or player-specific API is required by the renderer-facing path.

Dynamic camera Z, pitch, and FOV consumption remain intentionally deferred to their dedicated roadmap steps. At this stage the snapshot boundary is structural only and therefore low-risk.

Validation:

- Added API assertions to the pure test harness.
- Existing geometry and material tests continue to pass.
- No level format, DDA, clipping, texture, or Phaser framebuffer behaviour was changed.
- No editor or syntax errors were reported.

Next action: proceed with `P1-03` by isolating raw level conversion from renderer-ready cell data without changing the existing level format.

### P1-03 Completed — Level Normalisation Boundary

Added level normalisation to [scripts/system/Raycaster.js](scripts/system/Raycaster.js):

- `normaliseMap()` converts string rows and array rows into renderer-owned cell arrays.
- `normaliseCellDefinition()` applies floor and ceiling defaults and explicit null surface defaults.
- `loadCells()` now consumes normalised cell definitions before resolving materials.
- Cell lookup uses the normalised map rather than repeatedly interpreting the raw level map.

The existing `3dtestLevel.js` format remains unchanged. String map rows, array map rows, inline surfaces, named materials, and omitted surfaces remain supported. No sector, portal, or edge-geometry concepts were introduced.

Added pure tests for map and cell normalisation to [tests/raycaster-geometry.test.mjs](tests/raycaster-geometry.test.mjs).

Validation:

- The existing seven tests plus the new normalisation test pass.
- The browser-facing renderer API and `render(player)` compatibility path remain unchanged.
- No editor, syntax, or whitespace errors were reported.

This completes the initial P1 renderer data-boundary sequence. The next recommended work is `P3-01` formal segment geometry documentation/fixtures, followed by `P3-02` only when depth data is needed for sprites or visibility diagnostics.

### P3-01 through P3-04 Status — Segment and Visibility Foundation

The current renderer now has the intended P3 foundation:

- `traceRay()` performs the single DDA traversal and exposes explicit cell segment fields.
- Segment coordinates identify the cell traversed, while entry distances and hit coordinates identify its front boundary.
- Interval clipping is isolated in `isYVisible()` and `subtractInterval()` and uses reusable typed-array storage.
- Plane projection keeps actual ray distance separate from corrected projection distance.
- Pure tests cover segment ordering, entry/exit distances, plane projection, and interval splitting.

### P3-02 Completed — Per-Column Depth Buffer

Added a `Float32Array` depth buffer to [scripts/system/Raycaster.js](scripts/system/Raycaster.js).

- The buffer is reset to `Infinity` at the start of every frame.
- A column records the corrected distance of its nearest wall only when that wall fully closes the remaining visible interval.
- Interval clipping remains the authoritative visibility system; the depth buffer is an additional primitive for future sprites and diagnostics.
- Added `resetColumnDepth()` and `getColumnDepth()`.

### P4 Status

Completed:

- `P4-01` — Browser profiling and baseline measurements.
- `P4-03` — Cached plane projection constants and row factors.
- `P4-04` — Fixed-capacity, allocation-free visibility intervals.
- `P4-05` — Initial framebuffer upload measurement; upload was not the current bottleneck at the test resolution.

Deferred:

- `P4-02` — Replacing the plane distance division with an incremental recurrence.

The current row-factor lookup already removes repeated setup work, while the remaining plane calculation is mathematically sensitive. It should only be replaced after a multi-frame benchmark proves it is the dominant cost and a screenshot comparison is available.

### Corrected Roadmap Order

The original order is adjusted to reflect completed work and dependencies:

1. `P0-01/P0-02` — Baseline and optional diagnostics. **Closed.**
2. `P1-01/P1-02/P1-03` — Camera and level data boundaries. **Closed.**
3. `P2-01/P2-02` — Material cache and compatibility references. **Closed.**
4. `P10-01` — Pure geometry/material regression tests. **Closed.**
5. `P3-01/P3-03/P3-04` — Formal segment, visibility, and plane contracts. **Closed for the current cell model.**
6. `P3-02` — Per-column depth buffer. **Implemented; expand when sprites begin.**
7. `P4-01/P4-03/P4-04/P4-05` — Measured low-risk performance work. **Closed for the current baseline.**
8. `P10-02` — Add broader segment fixtures for variable-height cases.
9. `P5-01/P5-02/P5-03` — Consume dynamic camera Z, pitch, and FOV.
10. `P6-01/P6-02/P6-03` — Add sprites using the depth and visibility data.
11. `P7-01/P7-02` — Add edge descriptors and wall opening intervals when doors/windows are required.
12. `P4-02` — Revisit incremental plane distances only if profiling still justifies it.
13. `P8` — Add fog, lighting, and generalised sky incrementally.
14. `P9` — Complete the ECS/render-snapshot migration after the renderer snapshot contract has stabilised.

The next implementation should therefore target `P10-02`, not another broad renderer refactor. The main remaining open items are variable-height fixture coverage, dynamic camera state, sprites, edge openings, and measured plane optimisation.

### P10-02 Completed — Variable-Height Segment Fixtures

Expanded [tests/raycaster-geometry.test.mjs](tests/raycaster-geometry.test.mjs) with deterministic segment fixtures for:

- Height-8 and height-16 wall cells.
- Cell 3-style raised floor and short wall geometry.
- Adjacent cells with different floor and ceiling heights.
- Cells with `ceiling: null`.
- Multi-cell corridors with ordered entry and exit distances.
- String-map normalisation feeding the same DDA path used by the renderer.

The fixtures validate geometry and segment ownership rather than framebuffer pixels, keeping them fast and independent from Phaser and browser texture loading.

Validation:

- 13 raycaster geometry tests pass with `npm run test:raycaster`.
- Existing DDA, plane, interval, material, camera, normalisation, and depth tests remain green.
- No renderer algorithm or level data was changed.

### Updated Next Order

The variable-height coverage is now closed for the current test map. The next practical work is:

1. `P5-01` — Consume dynamic camera Z from the snapshot.
2. `P5-02` — Add pitch as a shared screen-space projection offset.
3. `P5-03` — Support runtime FOV changes with cache rebuilding.
4. `P6-01/P6-02/P6-03` — Add raw billboard sprites and depth-aware clipping.
5. `P7-01/P7-02` — Add edge descriptors and wall opening intervals when needed.
6. `P4-02` — Revisit incremental plane distances only after profiling demonstrates a remaining bottleneck.
7. `P8` — Add fog, lighting, and sky configuration incrementally.
8. `P9` — Complete ECS/render-snapshot migration after the snapshot contract is stable.

### P5-01 through P5-03 Completed — Dynamic Camera Projection

Implemented the camera projection steps in [scripts/system/Raycaster.js](scripts/system/Raycaster.js):

- `camera.z` now controls the frame-local camera height.
- `camera.pitch` applies a shared screen-space horizon offset.
- `camera.fov` can change at runtime.
- FOV changes rebuild `columnGeometry` and update focal length.
- Pitch changes rebuild the cached plane row factors against the new horizon.
- Plane intersections continue to use actual ray distance, while projected positions use the current frame's camera projection.
- The legacy `render(player)` wrapper remains unchanged for callers that do not provide camera fields.

The implementation uses frame-local projection state rather than mutating level geometry or player/gameplay state. DDA traversal remains independent of camera pitch and Z.

Added pure coverage for dynamic camera height, pitch, and FOV cache rebuilding. All 14 raycaster tests pass.

### Revised Next Order

The following items are now complete or intentionally deferred:

- P0 through P5-03: implemented for the current grid/cell renderer.
- P4-02: deferred until profiling demonstrates that plane distance division remains a meaningful bottleneck.
- P10-03: deferred until a stable browser capture process is available.

Next work should proceed in this order:

1. `P6-01` — Define raw billboard sprite render data.
2. `P6-02` — Add separate billboard projection and back-to-front ordering.
3. `P6-03` — Use wall depth and visible intervals for sprite occlusion.
4. `P7-01/P7-02` — Add optional edge descriptors and wall opening intervals when doors or windows are required.
5. `P4-02` — Revisit plane optimisation only after a multi-frame benchmark.
6. `P8` — Add fog, lighting, and configurable sky incrementally.
7. `P9` — Complete the ECS/render-snapshot migration once the renderer snapshot has stabilised.

### Billboard Coordinate Investigation — 2026-08-10

Investigated the reported apparent sprite arc using an explicit stationary-camera diagnostic in [tests/raycaster-geometry.test.mjs](tests/raycaster-geometry.test.mjs).

The sprite transform is now explicit in [scripts/system/Raycaster.js](scripts/system/Raycaster.js):

```text
dx = sprite.x - camera.x
dy = sprite.y - camera.y

cameraSpaceX = dx * cos(angle) + dy * sin(angle)   // forward/depth
cameraSpaceZ = -dx * sin(angle) + dy * cos(angle)  // camera-right/lateral

screenX = screenCenter + cameraSpaceZ * focalLength / cameraSpaceX
```

The diagnostic logs world position, camera position, angle, `dx`, `dy`, camera-space X/Z, depth, and projected screen X for a stationary sprite across multiple camera angles. It also verifies the directly-ahead case and the 45-degree rotation case.

Result:

- Euclidean distance is not used for horizontal projection.
- World and camera-space coordinates are not mixed.
- The camera origin is the same snapshot origin used by the wall renderer.
- The rotation sign matches the camera-right basis used by the raycaster.
- No angle-difference or billboard-orientation value is applied to the world position.
- Billboard scaling changes only projected size, not projected center.

The logged movement is the expected perspective result: as the fixed sprite approaches the camera plane's edge, its lateral/depth ratio changes nonlinearly and it moves toward the screen edge. Applying an additional fisheye correction would be incorrect because `cameraSpaceX` is already perpendicular camera-plane depth.

The next visual check should keep both camera position and sprite position fixed while rotating only the camera. If the sprite still appears to move incorrectly under that controlled test, the next suspect is framebuffer/screenshot interpretation or an external camera-position update rather than billboard projection mathematics.

### P6-01 through P6-03 Completed — Billboard Sprites

Implemented the initial sprite pipeline in [scripts/system/Raycaster.js](scripts/system/Raycaster.js):

- `camera.sprites` accepts plain sprite render data with `x`, `y`, `z`, `texture`, `width`, and `height`.
- Sprites are transformed into camera-relative forward/lateral coordinates.
- Billboards are perspective projected using the current focal length and camera projection.
- Sprites are sorted back-to-front before drawing.
- Sprite textures are decoded once and cached independently using `sprite:<textureKey>` cache entries.
- Transparent sprite pixels preserve their source alpha and do not overwrite the framebuffer.
- A per-pixel wall depth buffer prevents sprites from drawing through opaque wall pixels, including partial wall openings.
- The existing column interval clipping remains unchanged and continues to control wall/plane visibility.
- `projectBillboard()` isolates sprite geometry from texture loading and pixel drawing.

Sprite render data remains renderer-oriented; the raycaster does not know about entities, enemies, pickups, or gameplay components.

Validation:

- Added billboard projection coverage to [tests/raycaster-geometry.test.mjs](tests/raycaster-geometry.test.mjs).
- All 15 pure geometry, material, camera, depth, fixture, and billboard tests pass.
- Existing sprite-free rendering remains compatible because `camera.sprites` is optional.
- No editor, syntax, or whitespace errors were reported.

### Updated Roadmap Order

The next priorities are now:

1. `P7-01/P7-02` — Add optional edge descriptors and wall opening intervals when doors or windows are required.
2. `P10-03` — Establish browser screenshot regression captures for walls, planes, and sprites.
3. `P10-04` — Add multi-frame performance benchmarks including sprite-heavy scenes.
4. `P4-02` — Revisit incremental plane distances only if benchmarks identify it as a bottleneck.
5. `P8` — Add fog, lighting, and configurable sky incrementally.
6. `P9` — Complete the ECS/render-snapshot migration after the snapshot and sprite contracts stabilise.

### Sprite Arc Bug — Root Cause Found and Fixed — 2026-08-11

The "Billboard Coordinate Investigation" above concluded the lateral/depth transform itself was correct and left the reported sprite arc as an open, unexplained symptom. Re-auditing [scripts/system/Raycaster.js](scripts/system/Raycaster.js) against that transform found the actual cause one level up, in `focalLength`:

```js
this.focalLength = this.height / 2 / Math.tan(this.fov / 2); // wrong axis
```

`fov` is the renderer's horizontal field of view — `createColumnGeometry()` maps ray angles across `this.width`, independent of `focalLength`. Billboard projection, however, used `focalLength` for `centerX` and `projectedWidth`, so it implicitly assumed a ~91° horizontal FOV (derived from `height` = 180) instead of the configured 60° (which would come from `width` = 320). Walls stayed correct because their horizontal mapping never went through `focalLength`; sprites drifted from wall geometry as the camera rotated, which reads visually as the sprite arcing away from its anchor. Verified numerically: at 29° off-centre in a 320-wide viewport, sprite `centerX` lagged the equivalent wall column position by 67px; after the fix the two match exactly at every tested angle.

Fix: derive `focalLength` from `this.width` in both the constructor and the `updateProjection()` FOV-rebuild path (`P5-03`). This also matches the value the `P10-01` pure-test harness had independently hardcoded (`277.128` for `width: 320, fov: π/3`), which the real constructor had never actually produced until now.

### Drift and Duplication Cleanup — 2026-08-11

Audited the full renderer against this plan's completed sections and removed accumulated drift from the P0–P6 iterations, without changing any render algorithm or level data:

- Removed `getRayAngle()`, `renderSky()`, and `clearFrame()` — leftovers from the pre-`P4-03` render loop (superseded by cached `columnGeometry` direction vectors and the `backgroundPixels` blit) that were never deleted after the new loop replaced them. Confirmed unused anywhere in the codebase or tests before removal.
- Removed `getPlaneProjection()` — an intermediate `P3-04` wrapper superseded by direct `getPlaneScreenY()`/`getPlaneDistanceAtScreenY()` calls in `renderPlane()`; never called after that refactor landed.
- Deduplicated texture decoding between `loadSurface()` (cell materials, `P2-01`) and `loadSpriteSurface()` (sprites, `P6-02`): both independently grew an identical canvas/`drawImage`/`getImageData` block. Extracted the shared decode into `decodeImagePixels()`. Load-time only, so no per-frame cost either way.
- Removed duplicate `cameraX`/`cameraZ` fields from `getSpriteCameraSpace()` — exact duplicates of `lateral`/`depth` left behind after the fields were renamed for clarity; `projectBillboard()` now reads `cameraSpace.lateral` directly instead of the stale `cameraSpace.cameraX` alias. The `billboard rotation diagnostic` test had encoded the old (opposite) naming convention and was updated to assert `lateral`/`depth` instead of the removed aliases.

No hot-path allocations, DDA behaviour, clipping rules, or texture selection changed. `npm run test:raycaster` passes all 16 tests after both the fix and the cleanup.

### Projection Consolidation — 2026-08-11

A follow-up proposal asked to consolidate all camera/projection math into a small set of authoritative helpers, partly to make the `focalLength` axis bug structurally harder to reintroduce, and with an eventual (not immediate) eye toward a self-contained rendering core. Reviewed against the state above and scoped down to three low-risk changes, deliberately stopping short of unifying walls' angle-based DDA raycasting with sprites' forward camera-space projection — those are different, already-verified-equivalent algorithms, and forcing them through one abstraction would be a DDA rewrite without a measured need, which this plan's non-goals explicitly rule out.

Implemented in [scripts/system/Raycaster.js](scripts/system/Raycaster.js):

- Added `computeFocalLength(fov)` as the sole place `focalLength` is derived (`width / 2 / tan(fov / 2)`). The constructor and `updateProjection()` both call it instead of each carrying their own copy of the formula — the exact duplication that let the `height`-vs-`width` bug exist in only one of the two spots.
- Added `projectLateralToScreenX(lateral, depth)` as the named horizontal counterpart to `projectWorldZ()`. `projectBillboard()` now calls it instead of inlining the formula, giving any future caller (minimap, debug overlay, projectiles) a ready-made, correctly-derived conversion.
- Added a class-level comment stating the three projection invariants (`focalLength`, `screenX`, `screenY`) in one place, and explicitly noting that walls/planes satisfy the same `screenX` relationship implicitly through `createColumnGeometry()`'s per-column ray angles rather than calling `projectLateralToScreenX()` directly.

Declined the literal `cameraX` naming from the proposal for the lateral offset — it would recreate the exact ambiguity removed in the prior cleanup pass (`cameraSpace.cameraX`, the lateral offset, colliding with `camera.x`, the world-space camera position, inside the same diagnostic object). Kept `lateral`/`depth`.

No render algorithm, DDA traversal, or level data changed. `npm run test:raycaster` passes all 16 tests.

### Constructor-Coverage Test Added — 2026-08-11

Closed a structural blind spot in `P10-01`: `createPureRaycaster()` in [tests/raycaster-geometry.test.mjs](tests/raycaster-geometry.test.mjs) builds a raycaster via `Object.create(Raycaster.prototype)` and assigns fields directly (including `focalLength: 277.1281292110204`, hardcoded). It never calls `new Raycaster(...)`, so no amount of pure geometry testing could have caught the `height`-vs-`width` `focalLength` bug — the mock always supplied the already-correct value independent of what the real constructor computed.

Added `testConstructorDerivedProjection()`, with minimal `document`/`game` stubs (`createFakeCanvas`, `createFakeGame`, `withFakeDom`) sufficient to run the *real* constructor under Node. It checks `focalLength`, `columnGeometry.length`, and `planeRowFactors.length` for both a square-ish canvas and a canvas where width and height differ substantially (the case that exposes an axis mix-up), and checks `updateProjection()` rebuilds `focalLength` the same way on an FOV change.

Verified the test has teeth: temporarily reverted `computeFocalLength()` to the `height`-based formula, confirmed this new test fails immediately (second test in the run, right after `world-Z projection`) while all other pure tests still pass, then restored the fix and re-confirmed all 17 tests pass.

### Planning Note — 2026-08-11

Incorporated user priorities into the forward plan without reordering the sections above:

- **Steps** (a cell whose ceiling is low enough to walk over, e.g. `3` in [scripts/data/3dtestLevel.js](scripts/data/3dtestLevel.js): `floorHeight: 0, ceilingHeight: 0.5`) are blocked today purely because `isWall()`/`isWallWorld()` treat any cell with a `wall` material as fully blocking, regardless of height. The renderer already handles variable floor/ceiling heights correctly (that's what the `P10-02` fixtures validate) — this is a collision-rule gap, not a rendering gap, and it lives in the game layer (`level-whiteroom.js`'s `isWallWorld` calls), not in `Raycaster.js`. Estimated low effort: expose cell heights through a small, intentional query method, then let the caller decide passability and (optionally) drive `camera.z` from the standing cell's floor height using the `camera.z` support already added in `P5-01`. Distinct from `P7-02` (wall openings/windows), which is needed only for partial-height openings on a boundary with solid wall both above *and* below a gap — a genuinely separate, medium-effort feature.
- **Lighting/fog (`P8`)** should be prioritised ahead of `P9`, consistent with the plan's existing order, and designed from the start the same way sprites already work: plain per-frame data on the camera snapshot (e.g. `camera.lights`), with the renderer owning no lifecycle, identity, or persistence for lights across frames — matching `P6-01`'s existing sprite contract exactly.
- **Decoupling `Raycaster` from the Phaser game object** is Limitation #1 in this plan's original "Current Architecture Assessment" and hasn't been addressed yet. The constructor still calls `game.add.sprite`, `game.add.bitmapData`, and `game.cache.getImage` directly, and `resizeToCamera()`/`destroy()` touch the Phaser sprite directly. This is the most direct blocker to exposing `Raycaster` as a Phaser-ignorant rendering API — more so than `P9` itself, which is about the ECS *consumer* side. Recommend scheduling this as a mid-term item, ideally right before `P9`, so the ECS adapter is built against an already-decoupled renderer rather than needing rework afterward. Medium effort: inject an image-lookup function and move Phaser display-object wiring into a thin external wrapper, while `Raycaster` itself only produces `ImageData` per frame (it already does internally).
- `P9` itself should stay deferred until the parallel ECS overhaul in progress elsewhere in the repo (many `scripts/components/*` deletions in the working tree) stabilises — building the adapter against a moving target would mean redoing it.

### Configurable Cell Blocking / Steps — 2026-08-11

Implemented the "steps" item from the planning note above, per explicit direction that the rule belongs in `Raycaster.js`, not the level/game layer.

`Raycaster.js`:

- `normaliseCellDefinition()` now derives a `blocking` field, defaulting to `!!wall` so every existing level keeps today's behaviour unchanged. A cell can now set `blocking: false` explicitly to render a wall face without it obstructing movement — e.g. a step or curb.
- `isWall()`/`isWallWorld()` now check `cell.blocking` instead of `cell.wall`. Rendering (`segment.cell.wall` in `renderColumn`/`drawWall`, `castRay()`) is untouched — a cell's wall face and its collision behaviour are now independently configurable instead of the same boolean doing both jobs.
- Added `getStandingHeight()`/`getStandingHeightWorld()`: for a non-blocking cell that still has a wall face (a step), the standing surface is the top of that block (`ceilingHeight`), not its base (`floorHeight`); an open cell stands on its `floorHeight` as before.
- Added `getEyeHeightWorld()`, combining the above with the renderer's configured `cameraHeight` offset, so a caller can set an entity's world Z in one call without re-deriving the eye-height convention.

`scripts/data/3dtestLevel.js`: cell `3` (`floorHeight: 0, ceilingHeight: 0.5`, already the de facto "short wall" fixture referenced by `P10-02`) is now `blocking: false`, so it renders identically but is walkable.

`scripts/level-whiteroom.js`: collision calls are unchanged (`isWallWorld` already carries the new behaviour); added one line, `player.z = this.raycaster.getEyeHeightWorld(player.x, player.y)`, after movement resolves each frame. The game layer still owns `player.z` (per `P5-01`'s existing contract — the renderer never mutates caller state) but no longer needs to know *how* standing height is derived.

Deliberately did not add an automatic step-height limit (e.g. blocking based on a floor/ceiling height difference threshold) — the `blocking` flag is purely level-author-controlled, matching what was actually requested. A height-limited "can this specific entity climb this" rule, if wanted later, is a game-layer decision that can consume `getStandingHeight()`/`getStandingHeightWorld()` without any further renderer change.

Left the direct Phaser references in `Raycaster.js` (`game.add.sprite`, `game.cache.getImage`, etc.) untouched per explicit direction — that decoupling remains a separate, later task.

Added `testStepCollision()` and extended `testLevelNormalisation()` for the `blocking` default/override cases. All 18 tests pass.

### P8-02 — Lighting as Render Input — 2026-08-11

Implemented dynamic point lighting per the architecture direction: **ECS decides what lights exist → Raycaster decides how they affect pixels.** `P7`/`P10` are parked for now; this is scoped strictly to lighting, not fog (`P8-01`) or sky (`P8-03`).

`scripts/system/Raycaster.js`:

- `camera.lights` is an optional plain array of `{ x, y, z, radius, intensity, tint }`, consumed exactly once per `renderSnapshot()` call — no lifecycle, identity, or persistence owned by the renderer, matching the `camera.sprites` contract from `P6-01` exactly. `camera.ambient` (default `1`) is the baseline brightness multiplier every surface gets before lights are added.
- `resolveLights(lights)` normalises the raw per-frame list once per frame: drops lights with non-positive `radius`/`intensity`, precomputes `radiusSquared`, and normalises `tint` (0–255 per channel, default white) to a 0–1 multiplier — so the per-pixel sampling loop never repeats that division.
- `sampleLightRgb(worldX, worldY, worldZ, ambient, lights)` is the one place light contribution is computed: linear distance-based attenuation (`1 - distance/radius`), no shadows/occlusion, summed on top of `ambient`. `ambient: 1` with no lights returns `{r:1,g:1,b:1}` — an exact no-op multiplier.
- Walls, floor/ceiling planes, and sprites all route through this same function, each sampling the world position they already compute for other purposes: walls reuse `segment.entryHitX/Y` (fixed per column) plus the per-pixel `worldZ` already derived for texture mapping; planes reuse the per-pixel world X/Y already computed for `drawPlanePixel` plus their constant `planeHeight`; sprites sample once at the sprite's own anchor (`x, y, z`) and apply that single value across all of its pixels, since a billboard has no per-pixel world depth of its own.
- `copyPixel()`/`copySpritePixel()` take an optional `{r,g,b}` light multiplier; when absent (the default, zero-config path) they copy texture colour unchanged through the exact same branch as before, so callers that never pass `lights`/`ambient` pay only one added boolean check per pixel, no measurable behaviour or performance change.
- Output values are written into the existing `Uint8ClampedArray`-backed framebuffer, which auto-clamps to `[0,255]` — no manual clamping needed for bright/overlapping lights.

`scripts/level-whiteroom.js`: added `testLights` (one warm point light, mirroring how `testSprites` was introduced for `P6-01`) and `camera.ambient = 0.35`, so the effect is visible in the running demo without needing an ECS yet.

Validation: added `testLightResolution()` and `testLightSampling()` (pure math coverage) plus `testLightingRenderIntegration()`, which uses the real constructor (per the `P10-01` constructor-coverage pattern) to render the same scene three times and assert (a) explicit `lights: [], ambient: 1` produces a byte-identical framebuffer to omitting lighting entirely, and (b) a real light produces a different framebuffer — proving the no-op contract and the actual wiring at the full-frame level, not just in isolated helper functions. All 21 tests pass. User confirmed visually in-browser: tested and passed.

### P8-01 — Fog Zones — 2026-08-11

Implemented distance fog scoped per cell, per direction: "one area can contain fog, while another does not," with performance explicitly allowed to gate simpler ("zone on/off") over a continuously-varying field if needed. It wasn't needed — per-zone gating and a per-pixel gradient turned out to be the same cost class, so both are implemented.

`scripts/system/Raycaster.js`:

- A fog **zone is just whichever cells set `fog`** — no separate region/polygon system. `fog: true` is shorthand for the built-in/level defaults; `fog: {distance, color}` overrides either independently. Mirrors the existing `blocking`/`wall` pattern from the steps work, and normalises through `normaliseCellDefinition()` exactly the same way (`level.defaultFogDistance` / `level.defaultFogColor` as optional level-wide fallbacks, then a built-in default — `Raycaster.DEFAULT_FOG_COLOR`, which intentionally matches the sky fill colour, since blending toward the horizon colour is the conventional, natural-looking default when nothing is configured).
- `getFogBlend(fog, distance)` is the one place the blend is computed: linear ramp from 0 at `distance: 0` to fully-fogged at `fog.distance`, clamped, no cross-zone blending — a cell with no `fog` returns `null` immediately and costs nothing.
- Walls resolve fog **once per column** (a wall segment sits at one perpendicular depth regardless of row — the same depth already used for the `pixelDepth` buffer), floor/ceiling planes resolve it **per pixel** (their distance genuinely varies per row — reuses the distance the plane loop already computes for texture sampling), and sprites resolve it **once per sprite** using whichever cell the sprite's own `(x, y)` falls in (`getCell()`) and its `cameraSpace.depth` — the same three-tier granularity already established for lighting.
- `copyPixel()`/`copySpritePixel()` take an additional optional `fog` blend, applied after the lighting multiply (fog is atmosphere between the surface and the camera, not a property of the surface). With neither `light` nor `fog`, the exact original fast path runs unchanged.

`scripts/data/3dtestLevel.js`: cell `2` (an existing distinct stretch of corridor, not the ubiquitous open cell `0`) now carries `fog: {distance: 24, color: {r:90,g:90,b:100}}`, giving a real, spatially-localised fog zone using existing map geometry — no map edits needed.

Validation: added `testFogBlend()` (pure math: no-config, at-camera, half-distance, at/beyond-`distance` clamping) and `testFogRenderIntegration()`, which — like the lighting integration test — renders through the real constructor and asserts the no-op default reproduces an identical frame while an actual fog zone changes it. While writing that test, discovered the *existing* `testLightingRenderIntegration()`'s 1-cell-deep test room left `debugStats.planePixelsDrawn === 0` (the near wall filled the entire screen), meaning it had silently never exercised plane lighting at all despite passing — only wall lighting. Widened both integration tests' rooms and added an explicit `planePixelsDrawn > 0` assertion to both, so this class of false-positive can't recur silently. All 23 tests pass.

### Interface Documentation Added — 2026-08-11

Added [raycaster-api.md](raycaster-api.md) (constructor options, level/cell/surface data format, render entry points, the `camera` snapshot contract, sprite/light data shapes, collision/world-query methods, diagnostics, lifecycle, a minimal working example, common gotchas) and [raycaster-architecture.md](raycaster-architecture.md) (render pipeline walkthrough, key concepts, "where it's safe to extend this" / "where to be careful" guidance, testing patterns, known limitations) at the repo root, so a future agent can integrate with or extend the renderer without re-deriving context already established in this file. No code changed.

### Final Geometry Refactor — Wall Sections — 2026-08-11

Replaced "a cell boundary is one solid wall spanning floor-to-ceiling" with "a cell boundary is a list of independent vertical wall sections," per explicit direction to keep this rendering-only (no door gameplay, collision, or navigation) and to extend the existing visible-interval system rather than replace it.

`scripts/system/Raycaster.js`:

- `normaliseCellDefinition()` now produces `sections: [{bottom, top, material}, ...]`. A plain `wall` is normalised into a one-entry `sections` list spanning `floorHeight..ceilingHeight` — the existing, common case — so `sections` is the single authoritative representation the renderer reads, while `wall` is kept on both the normalised definition and the loaded cell purely as backward-compatible/informational sugar (existing levels and every hand-built test fixture that only sets `wall` keep working unmodified). `blocking` now defaults to `sections.length > 0` instead of `!!wall`.
- `renderColumn()`'s wall-handling block now loops over `segment.cell.sections`, projecting and drawing each one independently and subtracting only *that section's own* screen interval from visibility — an open gap between sections (or above/below all of them) is simply never subtracted, so the existing visibility-interval mechanism already lets whatever's behind the boundary (this cell's own floor/ceiling, or a further segment through the gap) render through it. No new mechanism was needed for "seeing past a boundary" — it's the same one that already let a short wall/step leave the ceiling visible above it.
- `drawWall()` was generalised into `drawWallSection()`, reading `section.bottom/top/material` instead of `segment.cell.floorHeight/ceilingHeight/wall`. For an ordinary single-section wall this is the exact same number of per-pixel operations as before — the efficient path for ordinary walls is preserved exactly, not just approximately. Multi-section cells pay only for the additional sections they actually define.
- `getStandingHeight()` and `castRay()` updated to check `sections.length` instead of `wall` truthiness (the two other places that read the old single-wall field for anything beyond rendering).
- Deliberately did not add any collision/gameplay interpretation of gaps (e.g. "can an entity fit through this opening"). `sections` is exposed via the existing `getCell()` for a collision system to read and interpret itself; the Raycaster only decides how sections affect pixels.

`scripts/data/3dtestLevel.js`: added cell `4`, a window (two sections — a sill and a lintel — with an eye-level gap) in the interior room's west wall (one map character changed), demonstrating the feature with real level data rather than only in tests.

Validation: extended `testLevelNormalisation()` for the `sections` shape (default-from-`wall`, explicit multi-section, per-section bottom/top defaulting, `sections` overriding `wall`), added `sections` to the two hand-built test fixtures whose assertions actually exercise `castRay()`/`getStandingHeight()` (`testDdaSegments`, `testStepCollision` — the other segment-extraction fixtures never read `wall`/`sections` at all and needed no changes), and added `testWallSectionsRenderIntegration()`, which renders a solid boundary and an equivalent one with a gap through the real constructor and asserts the windowed scene does strictly more wall-drawing work (`wallSegments`/`wallPixels`) and produces a different framebuffer — proving the gap is both reached and visible, without hand-predicting exact per-column ray geometry (a narrow test corridor's side walls contribute to the counts too, which an inequality assertion is robust to but an exact-value assertion would not have been). All 24 tests pass.

Updated `raycaster-api.md` and `raycaster-architecture.md` for `sections` (data format, `getCell()`/`castRay()` semantics, the render pipeline description, a fourth "where it's safe to extend this" pattern, and updated known-limitations entries for door/collision scope).

### Wall Section Cap Faces — 2026-08-11

Fixed a real gap the wall-sections work above shipped with: a section only drew its own vertical face, never the horizontal surface where it ends before the cell's floor/ceiling does — a window's sill had no visible top, its lintel no visible underside, so looking through/near an opening at an angle showed nothing there instead of a solid surface.

`scripts/system/Raycaster.js`:

- `normaliseCellDefinition()` now sorts `sections` by `bottom` once, at load time — not to change behaviour, but so the renderer can find a section's neighbours (and therefore whether it needs a cap) by simply indexing `sections[i - 1]`/`sections[i + 1]`, without re-sorting per frame.
- Added `drawSectionCaps()`, called right after each section's vertical face in `renderColumn()`. It draws a `renderPlane` plane at `section.top` if the next section above (or the cell's `ceilingHeight`, for the topmost section) leaves a gap, and at `section.bottom` if the section below (or the cell's `floorHeight`, for the bottommost section) leaves a gap. This is a plane exactly like a floor/ceiling — same `renderPlane` function, same per-pixel machinery, just scoped to one section's height and the segment's own distance range — so no new rendering concept was introduced, matching the "generic geometry, not window/door-specific" direction. Uses `section.material` for the cap, keeping the schema exactly as it was (no new fields).
- For an ordinary single-section wall, both cap conditions are always false (its own bottom/top already equal the cell's floor/ceiling), so zero extra `renderPlane` calls are made — the efficient path for ordinary walls is unaffected.
- `scripts/data/3dtestLevel.js`'s existing window (cell `4`) needed no changes — the fix applies automatically to any existing `sections` data.

Validation: added `testSectionCapsRenderIntegration()`, which places a window as the very last cell the ray can reach (nothing beyond it to reveal), isolating the cap faces as the *only* possible source of additional plane-drawing — asserts the solid variant draws zero plane pixels and the windowed variant draws more than zero. While building this, caught two problems with the *existing* `testWallSectionsRenderIntegration()`: its cap height (1) exactly coincided with `camera.z` (1), which `renderPlane` treats as degenerate and skips — silently defeating a test meant to exercise that exact cap; and a `wallPixels` inequality assertion that wasn't actually a reliable proxy once section sizes changed (two short sections can legitimately sum to fewer total rows-considered than one full-height wall). Fixed the height coincidence and replaced the unreliable assertion with a `planePixelsDrawn` inequality, which is what the cap fix is actually about. All 25 tests pass.

### Entity Visibility Query — `checkVisibility()` — 2026-08-11

Added a line-of-sight query for gameplay/AI that's entirely independent of rendering, per explicit direction that the renderer shouldn't need to be invoked to answer "can this entity see that one."

`scripts/system/Raycaster.js`:

- `checkVisibility(origin, target)` — `origin`/`target` are plain `{x, y, z?}` world points (`z` defaults to `0`, matching sprites/lights). Reuses the same 2D grid DDA (`createRay()`/`stepRay()`) `traceRay()` is built on, but does no projection, texture sampling, or pixel work, and never calls into `renderSnapshot`/`renderColumn` — it's a genuinely separate code path from rendering, not a wrapper around it.
- At each cell boundary the DDA crosses, it linearly interpolates the height the straight 3D line from `origin` to `target` has at that point (based on the fraction of horizontal distance travelled) and checks that height against the cell's `sections` — the exact same data rendering reads. An open section (a gap, a window) is transparent to this exactly as it is to rendering; a caller that changes a cell's `sections` between calls (a door opening) is reflected immediately, since this reads live cell data on every call rather than a cached/rendered snapshot.
- Deliberately does not check floor/ceiling occlusion (only wall `sections`) and deliberately does not check `blocking` (mirrors `castRay()` — a step's wall face still blocks sight even though it doesn't block movement). Both are documented as explicit scope boundaries in `raycaster-api.md`, the same way "no shadows" was scoped out of lighting.
- Returns `{visible, distance, hitDistance, hitX, hitY, mapX, mapY, cell}`. `distance` is always the full 3D origin→target distance (matching the requested `{visible, distance}` shape); the extra fields describe the obstruction when blocked (all `null` when visible), naming them consistently with `castRay()`'s existing return shape.
- Carries a `maxSteps` safety bound identical to `traceRay()`'s, even though the loop should always terminate naturally (reaching the target's horizontal distance, or leaving the map) — cheap insurance against a hang on malformed input.

Validation: added `testCheckVisibility()` using the existing no-DOM `createPureRaycaster`/`createSegmentFixture` harness (no image decoding or pixel buffer involved, so no fake DOM needed at all) — covers a clear line of sight through a window's gap, blocked at the same boundary when the line of sight is at the height of the window's solid sill (proving height-sensitivity, not just "does this cell have any wall"), blocked by a genuine interior full wall, a purely vertical line of sight (same XY, different Z) always being visible, and `z` defaulting to `0`. While building the fixture, caught a test-design mistake of my own: the first version placed the "full wall" test's origin *inside* the wall cell itself rather than in an open cell before it, which would have passed for the wrong reason; redesigned the fixture with disjoint open/wall/window stretches so each test crosses exactly the boundary type it's meant to. All 26 tests pass.

Updated `raycaster-api.md` (new "Line-of-Sight Queries" section, renumbered subsequent sections, a gotcha entry) and `raycaster-architecture.md` (a "geometry queries are a separate surface from rendering" key concept, and a fifth "where it's safe to extend this" pattern for non-rendering geometry queries).

### P8-03 — Panoramic Sky, and a Pitch Cutoff Fix — 2026-08-11

Added a level-wide skybox and, per an additional report mid-task, fixed a real pre-existing bug it shares a root cause with: the background used to stop at a fixed `height / 2` regardless of pitch, so pitching the camera steeply (reported in the whiteroom demo) showed a hard cut to black instead of the sky/background continuing down toward the floor.

`scripts/system/Raycaster.js`:

- `level.sky = { texture: "skyTexture" }` (any surface form — string, inline object, `{material, ...overrides}`) loads through the exact same `loadSurface()` pipeline as `wall`/`floor`/`ceiling`, once at construction — same caching, no new decode path. `this.sky` is `null` when unconfigured.
- **Root fix**: the background was previously a `backgroundPixels` buffer filled *once* at construction (`fillSky()`, hardcoded `Math.floor(height / 2)`) and blitted unchanged every frame via `pixels.set()`. That's only correct if nothing the background depends on can change after construction — but `renderHorizon` depends on `camera.pitch`, a per-frame value. Removed the precomputed buffer entirely; `renderSnapshot()` now does `pixels.fill(0)` followed by a fresh fill of `[0, skyRows)` every frame, where `skyRows` is the *current* `renderHorizon` clamped to the screen — so the background (textured or flat) always reaches exactly as far as the current pitch implies, up to the whole screen if pitched to look straight up.
- `fillFlatSky(pixels, skyRows)` replaces `fillSky()` for the no-`level.sky` case — same flat colour, now parameterized by the dynamic `skyRows` instead of a hardcoded half.
- `renderSky(pixels, camera, skyRows)` is the new textured path: horizontal texture position comes from `camera.angle` (plus each column's own `angleOffset`, from the existing `columnGeometry`) wrapped over a full 2π — `camera.x`/`camera.y` never enter the calculation, so movement never pans it, exactly as specified. Vertical position is the texture simply stretched to fill `[0, skyRows)` (no per-row perspective projection — deliberately not a full 3D skybox, per the given scope). A per-frame `skyRowScratch` (`Int32Array`, sized once at construction like the renderer's other scratch buffers) precomputes each screen row's texture row once, shared across all columns, instead of recomputing the same per-row value once per column.
- Entirely separate from cell geometry, collision, and depth rendering as required: `renderSky()`/`fillFlatSky()` never touch `this.cells`, `pixelDepth`, `columnDepth`, or any DDA traversal — it's a background layer drawn once before columns/sprites, and anything drawn afterward simply overwrites it wherever it exists.
- `scripts/data/3dtestLevel.js`: added `sky: { texture: "brickTexture" }` (reusing an already-loaded texture as a stand-in panorama, noted as such in a comment) so the feature is visible in the running demo without needing a new asset.

Validation: `testSkyConstructorLoading` (real constructor, confirms `level.sky` loads and unconfigured stays `null`), `testFillFlatSky` (direct, no-DOM: confirms the fill respects an arbitrary `skyRows` including the full screen height — the exact case that was previously impossible), `testRenderSkyFollowsAngleNotPosition` (direct, no-DOM, using a synthetic 4-column texture with a distinct red value per column: proves moving with a fixed angle produces byte-identical output, and turning changes exactly which texture column is sampled), and `testSkyTracksPitchEndToEnd` (real constructor, a void room with `maxDistance` short enough that no wall is ever reached, isolating the background from all other rendering: a probe row past the old fixed `height/2` split is untouched at zero pitch and becomes sky once pitch pushes `renderHorizon` past it — the exact reported bug, reproduced and proven fixed through the real `renderSnapshot()` path, not just at the unit level). While writing the pitch test, first placed `maxDistance` inside the level object instead of the raycaster options by mistake, silently reintroducing the wall into the scene and invalidating the isolation; caught by checking debug stats before trusting the assertion, not by the assertion happening to pass. All 30 tests pass.

Updated `raycaster-api.md` (new "Sky" subsection under Level Data Format) and `raycaster-architecture.md` (pipeline step 2 rewritten, a new "precomputing something that depends on a per-frame value" cautionary entry generalizing the lesson, and a known-limitations entry for the sky's stretch-not-project vertical mapping).

### Runtime Cell Mutation — Doors — 2026-08-11

User asked whether cell geometry/blocking could already be changed at runtime for doors, and whether there was a clean method for it. Investigation confirmed the architecture already supports it by construction — every read path (`isWallWorld`, `getStandingHeight`, `renderColumn`, `checkVisibility`) re-reads `this.cells[id]` fresh, nothing is cached — but there was no dedicated method, only the option of reaching into `getCell()`'s returned object and mutating it directly (workable, but undocumented, and easy to get wrong: cells are stored **by id**, so two map tiles sharing an id share the exact same object — mutating one door would open every tile using that id).

`scripts/system/Raycaster.js`:

- `setCellSections(id, sections)` — takes the same raw shape used when authoring a level (`[{bottom, top, material}, ...]`, heights optional and defaulting from the cell's *current* `floorHeight`/`ceilingHeight`, `material` a string/inline-object/material-reference), re-normalises and resolves it exactly like `normaliseCellDefinition()`/`loadCells()` do (including sorting by `bottom`, needed for `drawSectionCaps()`'s neighbour lookup), and writes the result into `this.cells[id].sections` in place. Deliberately does not touch `blocking` — that's an orthogonal call, matching the existing `wall`/`sections` vs. `blocking` separation established for steps.
- `setCellBlocking(id, blocking)` — sets `this.cells[id].blocking` directly.
- Both key by cell **id**, not `(x, y)`, to make the sharing explicit rather than hiding it behind a position lookup; both warn and return `null` for an unknown id rather than throwing, matching `loadSurface()`'s existing "missing texture" convention.

Validation: `testSetCellBlocking` (pure, no DOM) confirms `isWall()` reflects the change immediately and reverts cleanly; `testSetCellSections` (needs `loadSurface`, so wrapped in `withFakeDom` but using the lightweight `createPureRaycaster` with a `game`/`materialCache` override rather than the full constructor) confirms raw materials get resolved and heights/sorting default correctly; `testDoorRuntimeMutation` is the full scenario end-to-end on one live `Raycaster` instance — a closed door blocks `isWallWorld()`, blocks `checkVisibility()`, and renders as a solid wall; after calling both setters, the same instance immediately reflects the door as open on all three without any re-render/rebuild step, and the two rendered frames differ. All 33 tests pass.

Updated `raycaster-api.md` (new "Runtime Cell Mutation (Doors, Switches)" section, renumbered subsequent sections, a gotcha entry) and `raycaster-architecture.md` (a "nothing about a loaded cell is cached" key concept, and setter-specific guidance added to the existing per-cell-property extension pattern).

### Gameplay Query Capability Review — Aiming & Projectiles — 2026-08-11

User asked whether weapon-aiming (is a sprite dead-center in the camera) and fast-projectile-vs-wall collision were already supported, prompted by a team suggestion for three renderer query verbs (`castRay`/`castVisibility`/`castSegment`). Investigation confirmed both are already fully covered by existing methods, no new Raycaster code needed:

- **Dead-center check**: `getSpriteProjectionDiagnostic(camera, sprite)` already returns `projectedScreenX` via the existing camera-space transform and billboard projection — pure math, no rendering — comparable directly against `width / 2`. Combined with `checkVisibility(camera, sprite)` for the occlusion check ("dead-center" doesn't imply "unobstructed").
- **Fast-projectile collision**: `checkVisibility(origin, target)` is already a swept-segment check (walks the DDA grid between the two points, testing every boundary crossed, not just the endpoint) — exactly the tunnelling-proof property a projectile moving faster than one cell per frame needs. Calling it every frame with `target = position + velocity * dt` requires no new API.
- On the proposed `castRay`/`castVisibility`/`castSegment` naming: `castRay()` already matches; `castVisibility()` would just be `checkVisibility()` renamed (a naming decision, not new capability); `castSegment()` would duplicate `checkVisibility()`'s existing implementation, since a projectile's "origin + direction + distance" is trivially `target = origin + direction * distance`. Recommended not adding new API surface for this — deferred pending confirmation, not implemented.

Documented both recipes in `raycaster-api.md`'s new section 10, "Common Gameplay Recipes" (renumbering `Lifecycle`/`Minimal End-to-End Example`/`Common Gotchas` accordingly), with worked code for both scenarios so a future agent doesn't have to re-derive that these are already solved. No `Raycaster.js` code changed.
