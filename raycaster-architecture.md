# How the Raycaster Works, and How to Extend It Safely

This document explains `scripts/system/Raycaster.js` in broad strokes —
enough to orient a new contributor or agent — and then focuses on the
part that matters most for day-to-day work: **where it's safe to add
things, and where it isn't.**

For the concrete method-by-method interface (what to call, what shape to
pass), see [`raycaster-api.md`](raycaster-api.md). For the full dated
history of every change and the reasoning behind it, see
[`plan.md`](plan.md) — that file is the ground truth for *why* things
are the way they are; this document summarizes the parts that matter for
future changes without duplicating the whole log.

---

## 1. The mental model

It's a classic grid-based (Wolfenstein/Doom-style) software raycaster,
extended with variable floor/ceiling heights, billboarded sprites,
simple point lighting, and per-zone fog — rendered into a small
CPU-side pixel buffer that gets blitted into a Phaser `BitmapData`
texture once per frame.

```
render(player)
  -> createCameraSnapshot(player)   // player-shaped -> plain camera data
  -> renderSnapshot(camera)         // the actual per-frame render
```

Everything downstream of `renderSnapshot` works with **plain data**: a
`camera` object, a `level`'s already-loaded `cells`, and optional
`sprites`/`lights` arrays. The renderer does not hold a reference to a
player entity, an ECS world, or anything gameplay-shaped — it only ever
sees what's handed to it for the current frame. This is deliberate and
load-bearing; see [Section 4](#4-where-its-safe-to-extend-this).

## 2. The render pipeline, step by step

`renderSnapshot(camera)` does, in order:

1. **`updateProjection(camera)`** — resolves this frame's `fov` (rebuilds
   `focalLength`/`columnGeometry` if it changed), `renderCameraHeight`
   (from `camera.z`), and `renderHorizon` (from `camera.pitch`), plus the
   cached `planeRowFactors` for floor/ceiling math.
2. **Reset the frame** — blit the pre-rendered sky (`backgroundPixels`,
   filled once at construction) over the whole pixel buffer, reset the
   per-column/per-pixel depth buffers (`columnDepth`, `pixelDepth`).
3. **Resolve lighting** — `resolveLights(camera.lights)` normalizes the
   raw per-frame light list once (drops dead lights, precomputes
   `radiusSquared`, normalizes `tint`); bundled with `camera.ambient`
   into one small `lighting` context object passed down through
   everything below.
4. **For each screen column** (`this.width` of them):
   - Compute that column's ray angle from the pre-built
     `columnGeometry` (one atan per column, cached at construction/FOV
     change, not recomputed per frame).
   - **`traceRay(...)`** — a single DDA grid traversal from the camera
     out to `maxDistance`, producing an ordered list of **segments**:
     one entry per grid cell crossed, each carrying `entryDistance`,
     `exitDistance`, which side of the cell was entered, and the exact
     world hit point. Segment objects are reused across frames
     (`segmentScratch`) to avoid per-frame allocation.
   - **`renderColumn(...)`** walks those segments front-to-back and, for
     each one:
     - If the cell has a `wall`, computes the fisheye-corrected distance
       (`getCorrectedDistance`) and calls **`drawWall`**, which draws
       the vertical strip of texture for that column and updates
       `pixelDepth` (used later for sprite occlusion).
     - Calls **`renderPlane`** twice (floor, then ceiling), which draws
       whatever rows of that column fall within the cell's visible
       vertical span.
     - A **visibility interval** (`visibleIntervalScratch`, a flat
       `Float64Array` of `[top, bottom]` pairs per column) tracks which
       screen rows are still "open" as segments consume them —
       this is what lets a short wall/step leave a visible strip of
       floor and ceiling above and below it in the same column, and is
       also what lets rendering stop early once a column is fully
       covered.
5. **`renderSprites(camera, camera.sprites, ...)`** — after all columns
   are drawn (so `pixelDepth` is fully populated), transforms each
   sprite into camera-space (`getSpriteCameraSpace`), sorts back-to-front,
   and draws each as a flat billboard (`renderBillboard`/
   `projectBillboard`), skipping any pixel that's behind a nearer wall.
6. **Upload** — `putImageData` into the Phaser `BitmapData`, done.

Walls and planes are two genuinely different techniques living side by
side: walls use **inverse mapping** (screen column → ray angle → DDA
distance — the ray IS the column, no separate projection step needed).
Sprites use **forward mapping** (world position → camera-space →
project to screen X/Y, since nothing is ray-cast for a billboard). Both
are proven algebraically equivalent for the horizontal axis (see the
class-level comment at the top of `Raycaster.js`) — don't assume they
need to be unified into one code path; they're different because the
things they draw are different shapes.

## 3. Key concepts, briefly

- **Cells, not entities.** The level is a 2D grid; each grid cell has a
  numeric/string id, and each distinct id maps to one cell *definition*
  (floor/ceiling height, wall/floor/ceiling surfaces, `blocking`,
  `fog`). Many map positions typically share one cell definition.
- **Corrected vs. raw distance.** `entryDistance`/`exitDistance` on a
  segment are raw ray-travel distances. Anywhere you see "distance" used
  for *projection* (wall height, plane row, fog, light falloff), it's
  been passed through `getCorrectedDistance()` first — the perpendicular
  distance to the camera plane, not the Euclidean ray distance. Mixing
  these two up produces fisheye distortion; this is exactly the kind of
  bug this codebase has hit before (see `plan.md`'s sprite-arc history).
- **The three-tier granularity pattern for lighting and fog.** Both
  features reuse this same structure, and any new per-pixel effect
  should probably follow it too:
  - **Walls**: resolved **once per column** — a wall segment sits at one
    perpendicular depth regardless of row, only its texture row varies.
  - **Planes** (floor/ceiling): resolved **per pixel** — distance
    genuinely varies per row (the floor gets closer toward the bottom
    of the screen).
  - **Sprites**: resolved **once per sprite**, at its anchor position —
    a billboard has no real per-pixel world depth of its own.
- **`pixelDepth`/`columnDepth`.** A per-pixel and per-column depth
  buffer, updated as walls are drawn, used so sprites don't draw through
  nearer walls. There's no equivalent depth recorded for *plane* pixels
  — floors/ceilings never occlude sprites in this grid model (any
  elevation change is represented by a wall face, which does get
  recorded), so this is an intentional simplification, not a gap.
- **Materials cache.** Textures are decoded once (`decodeImagePixels`,
  shared by both cell surfaces and sprites) and cached by
  `texture:worldWidth:worldHeight` (or `sprite:texture`), so repeated
  references to the same texture at the same scale don't redecode.
- **The `render(player)` legacy wrapper** exists purely so old call
  sites keep working; new code should call `createCameraSnapshot` +
  `renderSnapshot` directly to attach `sprites`/`lights`/`ambient`.

## 4. Where it's safe to extend this

The renderer has grown three features (steps/`blocking`, lighting, fog)
on top of its original wall/floor/ceiling core, each following the same
few extension shapes. New features should almost always fit into one of
these:

### Adding a new per-cell property (like `blocking`, `fog`)

1. Resolve/default it in **`normaliseCellDefinition()`** — default it to
   whatever preserves *today's* behavior for every existing level (see
   how `blocking` defaults to `!!wall`, and `fog` defaults to `null`).
2. Carry it through in **`loadCells()`** onto the loaded cell object.
3. Read it wherever it's needed (`drawWall`, `renderPlane`,
   `isWall`, etc.) — don't add a second, parallel place that also knows
   about cell configuration.

This is intentionally cheap: normalization happens once at load time,
not per frame, so there's no hot-path cost to worry about.

### Adding a new per-frame render input (like `camera.sprites`, `camera.lights`)

1. It's a plain array (or object) on the `camera` snapshot, optional,
   defaulting to "no effect" when absent.
2. The Raycaster **must not** track identity or lifecycle for entries in
   it across frames — resolve/normalize it fresh at the top of
   `renderSnapshot` (see `resolveLights`) and use the result for that
   frame only. If a "thing" needs to persist or have state, that state
   lives on the caller's side, not here.
3. Verify the empty/default case reproduces byte-identical output to
   omitting the field entirely — write an integration test like
   `testLightingRenderIntegration`/`testFogRenderIntegration` in
   `tests/raycaster-geometry.test.mjs` that renders once with the field
   omitted and once with the explicit default, and asserts the two
   framebuffers are `deepEqual`. This is the single most valuable test
   you can add for a new optional feature, and it's cheap.

### Adding a new per-pixel visual effect (like lighting, fog)

Follow the `light`/`fog` pattern in `copyPixel`/`copySpritePixel`:
add it as an additional **optional trailing parameter**, `null`/absent
by default, with the existing zero-cost fast path preserved when neither
new nor existing optional effects are active:

```js
if (!light && !fog /* && !yourNewThing */) {
  // exact original fast path, unchanged
  return;
}
```

Resolve your effect at whichever granularity is actually correct for
that surface type (see the three-tier pattern above) — not always
per-pixel. A per-column or per-sprite resolution that's mathematically
exact (like wall fog/lighting-position reuse) is both cheaper and not a
compromise.

### Adding new debug visibility

Add a counter to `createDebugStats()`, increment it behind `if
(this.debug)` at the relevant call site, and it's automatically exposed
through `getDebugStats()`/`debugLogEvery`. No per-frame cost when
`debug` is off.

## 5. Where to be careful

### The projection formulas

`focalLength`, `projectWorldZ()`, and `projectLateralToScreenX()` are
each meant to have **exactly one** implementation — read the class-level
comment at the very top of `Raycaster.js` before touching any of them.
The concrete failure mode already shipped once: `focalLength` was
computed from `height` when `fov` is defined as the *horizontal* field
of view (derived from `width`), causing sprites to visibly drift/arc
relative to walls as the camera rotated. `computeFocalLength()` now
exists specifically so this value has one source; don't reintroduce a
second inline copy of that formula anywhere.

If you touch projection math, add or extend a test that constructs the
**real `Raycaster` via `new Raycaster(...)`** (see
`testConstructorDerivedProjection` and its `createFakeCanvas`/
`createFakeGame`/`withFakeDom` helpers), not just the `createPureRaycaster`
prototype mock. The mock assigns fields directly onto
`Object.create(Raycaster.prototype)` and can never catch a bug in a
*derived* value like `focalLength` — it only proves the math is correct
once you've told it what the math should produce. This exact gap is what
let the bug above go undetected for a while.

### Test rooms that are too small

An integration test that renders a scene and checks the resulting pixel
buffer is only as good as the scene actually exercising the code path
under test. A 1-cell-deep test room's near wall can fill the *entire*
screen, leaving zero floor/ceiling pixels drawn — `debugStats
.planePixelsDrawn` silently stays `0` and a plane-lighting/fog test can
pass while proving nothing. Both `testLightingRenderIntegration` and
`testFogRenderIntegration` assert `planePixelsDrawn > 0` for exactly
this reason — copy that pattern for any new render-integration test.

### The wall/plane hot loops

`drawWall`, `renderPlane`, `drawPlanePixel`, `copyPixel`,
`copySpritePixel`, and `subtractInterval` run once per screen pixel or
per screen column, every frame. Before changing them:

- Don't allocate objects inside the per-pixel loops (the existing code
  reuses scratch arrays/objects — `segmentScratch`,
  `visibleIntervalScratch` — for exactly this reason).
- Keep the "nothing extra enabled" path exactly as cheap as it was
  before your change (see the `copyPixel` fast-path pattern above).
- Don't guess at a performance fix — enable `debug: true`, look at
  `getDebugStats()`, and change what the numbers actually show is
  expensive. `plan.md`'s `P4` entries are a record of this project
  consistently doing that and deferring changes that measurement didn't
  justify (see `P4-02`, still deferred).

### Walls vs. planes are genuinely different algorithms, on purpose

Don't try to unify wall rendering (inverse ray-angle mapping) and sprite
rendering (forward camera-space projection) into one shared code path
"for consistency." They're proven mathematically equivalent where it
matters (horizontal screen position) but are different techniques for
good reason — walls are ray-marched because there's a whole grid to
traverse, sprites are projected because a billboard has no grid to
traverse. Forcing them together would mean rewriting DDA raycasting for
no correctness benefit.

## 6. Testing

```sh
npm run test:raycaster
```

Runs `tests/raycaster-geometry.test.mjs` — a dependency-free Node script
(no browser, no Phaser) covering geometry, projection, materials,
camera, lighting, fog, and collision. Two harness patterns exist and
matter differently:

- **`createPureRaycaster(overrides)`** — fast, no DOM: builds a raycaster
  by assigning fields onto the prototype directly. Good for testing
  *behavior given known state* (e.g. "given this focalLength, does
  `projectWorldZ` return the right value?"). **Cannot** catch bugs in
  values the real constructor derives, since it never runs the
  constructor.
- **`withFakeDom(fn)` + `createFakeGame()` + `createFakeCanvas()`** —
  slower but exercises the *real* `new Raycaster(...)`, including image
  decoding, for tests that need to prove the actual wiring works (FOV →
  focalLength derivation, a full rendered frame, etc.). Use this
  whenever the thing you're testing is something the constructor or
  `renderSnapshot` computes, not something you can just hand to a mock.

There is currently no automated screenshot/visual regression suite —
visual correctness for anything not covered by a framebuffer-diff
integration test (see `testLightingRenderIntegration`/
`testFogRenderIntegration` for the pattern) still needs a manual
`npm start` check in a browser.

## 7. Known limitations (intentional, not oversights)

- **Still coupled to the Phaser `game` object** for image loading
  (`game.cache.getImage`) and display (`game.add.sprite`/`bitmapData`).
  This is the main remaining blocker to using the Raycaster as a fully
  Phaser-ignorant rendering core; deliberately deferred rather than
  bundled in with unrelated feature work — see `plan.md`'s planning
  notes for why and when this is expected to be tackled.
- **No shadows or light occlusion.** Lights shine through walls between
  themselves and the surface being lit. Explicitly out of scope per the
  lighting architecture direction in `plan.md` (`P8-02`).
- **No cross-zone fog blending.** Fog is resolved per-surface from
  whichever single cell that surface belongs to — crossing a zone
  boundary is a hard edge, not a gradient.
- **No sectors/portals, no non-grid geometry.** The level is a uniform
  grid; doors/windows/openings (`P7` in `plan.md`) aren't implemented
  yet, and won't be until edge descriptors and openings prove the grid
  model insufficient.
- **No level hot-swapping.** `level` is only ever read at construction;
  changing levels means constructing a new `Raycaster`.
- **ECS is not wired in yet.** `camera.sprites`/`camera.lights` exist
  specifically so a future `LightSystem`/entity system can feed the
  renderer without the renderer needing to change — see
  [`raycaster-api.md`](raycaster-api.md) for the exact contract those
  systems should target.
