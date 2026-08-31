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
2. **Reset the frame and draw the sky** — clear the pixel buffer, then
   fill rows `[0, skyRows)` (`skyRows` = the *current* `renderHorizon`,
   clamped to the screen — recomputed every frame, not a static
   precomputed buffer, specifically so it tracks pitch correctly all the
   way to the edges of the screen) with either `fillFlatSky()` (no
   `level.sky`: the flat background colour) or `renderSky()` (a
   `level.sky` texture: horizontal position from `camera.angle` only,
   vertical position stretched to fit the current sky region — see
   `raycaster-api.md`'s Sky section). Then reset the per-column/per-pixel
   depth buffers (`columnDepth`, `pixelDepth`). The sky is a background
   layer only: it doesn't touch cell data, collision, or either depth
   buffer, and anything drawn afterward (walls, planes, sprites) simply
   overwrites it wherever it exists.
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
     - If the cell has any `sections` (an ordinary full-height wall is
       just a one-entry `sections` list — see `normaliseCellDefinition()`
       and [Section 4](#4-where-its-safe-to-extend-this)), computes the
       fisheye-corrected distance (`getCorrectedDistance`) once, then
       calls **`drawWallSection`** once per section, which draws that
       section's own vertical strip of texture for that column and
       updates `pixelDepth` (used later for sprite occlusion), then
       **`drawSectionCaps`**, which draws the section's horizontal top
       and/or bottom face wherever there's actually open space adjacent
       to it (a sill's visible top, a lintel's visible underside) by
       calling `renderPlane` again — a cap is just a floor/ceiling-shaped
       plane scoped to one section's height, so no new geometry code was
       needed for it. A gap between sections (or above/below all of
       them) simply isn't subtracted from the visibility interval, so
       whatever's behind the boundary — this same cell's own floor/
       ceiling, or a further segment — remains free to render into it.
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
  (floor/ceiling height, `sections`/floor/ceiling surfaces, `blocking`,
  `fog`). Many map positions typically share one cell definition.
- **A boundary is a list of sections, not one solid span.** `sections`
  (an array of independent `{bottom, top, material}` vertical bands) is
  the authoritative wall representation; `wall` is sugar for a one-entry
  `sections` list spanning the whole cell. This is what makes windows,
  arches, railings, and overhangs possible without a second geometry
  system — see [Section 4](#4-where-its-safe-to-extend-this).
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
- **Geometry queries are a separate surface from rendering.**
  `castRay()` and `checkVisibility()` reuse the same DDA primitives
  (`createRay`/`stepRay`) as `traceRay()`, but never touch projection,
  texture sampling, or the pixel buffer — they don't call
  `renderSnapshot`/`renderColumn` at all. `checkVisibility()` in
  particular exists so AI/gameplay line-of-sight checks don't need to
  render a frame to answer "can A see B" — see `raycaster-api.md`.
- **Nothing about a loaded cell is cached or snapshotted after
  `loadCells()`.** Every read path (`isWallWorld`, `getStandingHeight`,
  `renderColumn`, `checkVisibility`) calls `getCell()`/reads
  `this.cells[id]` fresh, every time. This is what makes
  `setCellSections()`/`setCellBlocking()` (runtime door/switch support)
  possible without any extra plumbing: mutating a cell object in place is
  visible everywhere immediately, because nowhere held onto an
  already-computed answer from an earlier frame.

## 4. Where it's safe to extend this

The renderer has grown four features (`sections`, steps/`blocking`,
lighting, fog) on top of its original wall/floor/ceiling core, each
following the same few extension shapes. New features should almost
always fit into one of these:

### Adding a new per-cell property (like `blocking`, `fog`)

1. Resolve/default it in **`normaliseCellDefinition()`** — default it to
   whatever preserves *today's* behavior for every existing level (see
   how `blocking` defaults to `sections.length > 0`, and `fog` defaults
   to `null`).
2. Carry it through in **`loadCells()`** onto the loaded cell object.
3. Read it wherever it's needed (`drawWallSection`, `renderPlane`,
   `isWall`, etc.) — don't add a second, parallel place that also knows
   about cell configuration.

This is intentionally cheap: normalization happens once at load time,
not per frame, so there's no hot-path cost to worry about.

If the property should also be **mutable at runtime** (like
`sections`/`blocking` via `setCellSections()`/`setCellBlocking()`), add a
setter that:

1. Looks the cell up by **id** (`this.cells[String(id)]`), not by an
   `(x, y)` position — a position resolves to a shared cell object, and
   a setter that took a position would obscure that sharing instead of
   making it explicit.
2. Re-normalizes the input the same way `normaliseCellDefinition()`
   would (same defaults, same `loadSurface()` calls for any raw
   materials) — don't require the caller to hand-build the already-
   loaded shape themselves.
3. Mutates the cell object **in place** rather than replacing
   `this.cells[id]` with a new object — nothing needs to be told the
   reference changed, because nothing holds a stale reference to begin
   with (see the "nothing about a loaded cell is cached" key concept
   above).
4. Warns and returns `null` for an unknown id rather than throwing,
   matching `loadSurface()`'s existing "missing texture" convention.

### Adding partial/multi-band wall geometry (like `sections`)

This is really a specific case of the pattern above, but it's the
biggest structural addition so far and worth spelling out. `sections` on
a cell — `[{bottom, top, material}, ...]` — replaced "one wall spans the
whole cell" with "one boundary is a list of independent vertical bands."
The key decisions that made this a narrow, additive change rather than a
rewrite:

- **`wall` still exists** and is normalized into a one-entry `sections`
  list (`normaliseCellDefinition()`), so every existing level and every
  hand-built test fixture that never learns about `sections` keeps
  working unmodified.
- **The renderer loops over `sections`** in `renderColumn()`'s
  wall-handling block instead of branching on a single `cell.wall`, and
  `drawWallSection()` reads `section.bottom/top/material` instead of
  `segment.cell.floorHeight/ceilingHeight/wall`. For the one-section
  (ordinary wall) case this is *exactly* the same number of operations
  as before — no cost was added for levels that don't use multiple
  sections.
- **Gaps need no new mechanism.** An open band between (or above/below)
  sections just isn't subtracted from the column's visibility interval,
  so the existing interval system already lets whatever's behind the
  boundary show through — this is the same mechanism that already let a
  short wall/step leave open space above it.
- **No collision/gameplay interpretation was added.** `sections` is
  exposed via `getCell()` for a collision system to read and interpret
  itself (see `raycaster-api.md`'s `getStandingHeight()` and `getCell()`
  entries); the Raycaster only decides how sections affect pixels, never
  whether an entity can pass through a gap.
- **A section's own vertical face isn't the whole picture — its cap
  faces are a `renderPlane` call, not new geometry.** The first version
  of `sections` only drew each section's vertical face, leaving no
  horizontal surface where a section ends before the cell's own floor/
  ceiling does — a window's sill had no visible top, its lintel no
  visible underside. `drawSectionCaps()` fixed this by drawing a
  `renderPlane` plane at `section.top`/`section.bottom` whenever the
  neighbouring section (or the cell's floor/ceiling, for the outermost
  section) leaves a gap there — reusing the exact same plane renderer
  floors/ceilings already use, just scoped to one section's height and
  this segment's distance range, rather than inventing a new kind of
  surface. `sections` is kept sorted by `bottom` (`normaliseCellDefinition()`)
  specifically so a section's neighbours — and therefore whether it needs
  a cap — are just `sections[i - 1]`/`sections[i + 1]`. An ordinary
  full-height wall (one section, whose own bottom/top already equal the
  cell's floor/ceiling) draws zero caps, so this cost nothing for the
  common case.

If you add another structural cell property, look for this same shape:
can the old field be normalized into the new representation instead of
living alongside it forever, and does the hot loop only pay for what a
level actually uses?

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

### Adding a non-rendering geometry query (like `castRay`, `checkVisibility`)

For a query gameplay/AI needs that's about the level's geometry but
isn't rendering a frame:

1. Build it from `createRay()`/`stepRay()` directly (the same 2D grid
   DDA `traceRay()` uses), not by calling `traceRay()` and discarding
   most of what it computes, and never by calling `renderSnapshot`/
   `renderColumn` — those do projection and pixel work this kind of
   query has no use for and shouldn't pay for.
2. Read whatever cell data the query needs (`sections`, `blocking`,
   heights) directly via `getCell()` at each step, live — don't snapshot
   or cache it, so a caller that mutates level data between calls (a
   door's `sections` changing as it opens) sees it immediately.
3. Add a `maxSteps` bound (mirroring `traceRay()`'s) even if the loop
   should always terminate naturally (reaching the query's target
   distance, or leaving the map) — cheap insurance against a hang on
   malformed input, not a correctness requirement in the normal case.
4. Test it with `createPureRaycaster`/`createSegmentFixture` (no DOM
   needed at all, since there's no image decoding or pixel buffer
   involved) — see `testCheckVisibility()`.

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

### Precomputing something that depends on a per-frame value

The sky/background used to be a single buffer filled once at
construction (`fillSky()`, a fixed `height / 2` split) and blitted
unchanged every frame. That was correct only as long as nothing about
the background could vary — once pitch could move `renderHorizon` away
from `height / 2`, the precomputed buffer silently stopped matching
reality: at steep pitch the background still stopped exactly at the old
static line, showing a hard cut to black/transparent instead of
continuing to track the horizon. The general lesson: before caching
something "once, at construction" for performance, check whether every
input it depends on is actually construction-time-fixed. `renderHorizon`
depends on `camera.pitch`, a per-frame value, so anything derived from it
(now `fillFlatSky`/`renderSky`, parameterized by the current `skyRows`
every frame) has to be recomputed every frame too, no matter how cheap
that recomputation is. This didn't reintroduce a real performance cost
here — `pixels.fill(0)` plus a same-size-as-before fill loop is the same
cost class as the `pixels.set()` it replaced — it just moved the point
where the sky region's extent is decided from "once, wrong for pitch"
to "every frame, correct for pitch."

### Test rooms that are too small

An integration test that renders a scene and checks the resulting pixel
buffer is only as good as the scene actually exercising the code path
under test. A 1-cell-deep test room's near wall can fill the *entire*
screen, leaving zero floor/ceiling pixels drawn — `debugStats
.planePixelsDrawn` silently stays `0` and a plane-lighting/fog test can
pass while proving nothing. Both `testLightingRenderIntegration` and
`testFogRenderIntegration` assert `planePixelsDrawn > 0` for exactly
this reason — copy that pattern for any new render-integration test.

A related trap for a feature that changes column-level *behavior*
(rather than pixel colour) rather than just checking pixels differ:
prefer comparing debug-stat *counts* between two variants of a scene
(e.g. `testWallSectionsRenderIntegration` compares `wallSegments`/
`wallPixels` between a solid boundary and an equivalent one with a gap)
over predicting exact counts by hand. Exact per-column ray geometry is
easy to get subtly wrong when reasoned about on paper (e.g. a narrow
1-cell-wide corridor's side walls contribute to the count too); an
inequality between "the two scenes must produce different amounts of
drawing work" is robust to that and still meaningfully proves the
feature works.

### The wall/plane hot loops

`drawWallSection`, `renderPlane`, `drawPlanePixel`, `copyPixel`,
`copySpritePixel`, and `subtractInterval` run once per screen pixel, per
screen column, or per section, every frame. Before changing them:

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
- **No sectors/portals, no non-grid geometry.** The level is still a
  uniform grid — `sections` add windows/arches/railings/overhangs
  *within* that grid, they don't add rooms of arbitrary shape or
  portal-style visibility between non-adjacent areas.
- **No door gameplay, opening/closing logic, collision, or navigation.**
  `sections` is deliberately just data the renderer draws. A door is
  meant to be built by a caller changing the `bottom`/`top`/`material` it
  supplies for a boundary's sections between frames (e.g. animating a
  gap growing as a door slides open) — the Raycaster has no concept of
  "door," "open amount," or door state, and shouldn't gain one.
- **`sections`-aware collision is not provided.** `isWallWorld()`/
  `blocking` remain whole-cell and coarse, unaware of gaps between
  sections. A collision system that needs to know whether an entity fits
  under a specific overhang or through a specific window must read
  `getCell(x, y).sections` itself and apply its own rule.
- **No level hot-swapping.** `level` is only ever read at construction;
  changing levels means constructing a new `Raycaster`.
- **Sky is not a full 3D skybox.** `level.sky` scrolls horizontally with
  `camera.angle` and fills vertically to the current `renderHorizon`, but
  the texture is stretched to fit rather than projected per-row — no
  per-pixel angular mapping, no separate handling for a horizon line
  within the texture itself. It's one level-wide texture, not multiple
  faces/directions.
- **ECS is not wired in yet.** `camera.sprites`/`camera.lights` exist
  specifically so a future `LightSystem`/entity system can feed the
  renderer without the renderer needing to change — see
  [`raycaster-api.md`](raycaster-api.md) for the exact contract those
  systems should target.
