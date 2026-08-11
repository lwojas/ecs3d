# Raycaster Interface Reference

This document describes the **current, actual interface** of `Raycaster`
(`scripts/system/Raycaster.js`) — every constructor option, every render
input, and every public method a caller might need. It's written so an
agent can integrate with the Raycaster correctly without reading its
internals.

For *how it works* and *how to extend it safely*, see
[`raycaster-architecture.md`](raycaster-architecture.md). For the
project's long-term goals, see [`readme.md`](readme.md). For a dated
log of every change made to the renderer and why, see
[`plan.md`](plan.md).

The Raycaster is a **renderer only**. It does not know about entities,
components, input, AI, weapons, or gameplay rules. It consumes plain
per-frame data and produces pixels. Collision decisions, player state,
and sprite/light lifecycle all belong to the caller.

---

## 1. Constructing a Raycaster

```js
import { Raycaster } from "./system/Raycaster.js";

const raycaster = new Raycaster(game, level, options);
```

### `game` (required)

A Phaser 2 `Phaser.Game` instance (or an object shaped like one — see
`tests/raycaster-geometry.test.mjs`'s `createFakeGame()` for the minimal
surface needed to construct one without a real Phaser runtime). The
Raycaster calls into it directly:

| Call | When | Purpose |
|---|---|---|
| `game.add.sprite(0, 0, null)` | constructor | The on-screen Phaser display object the rendered frame is shown through. |
| `game.add.bitmapData(width, height)` | constructor | Backing texture uploaded to every frame. |
| `game.cache.getImage(key)` | first time a texture key is used (wall/floor/ceiling/sprite) | Must return an already-loaded Phaser image (i.e. call `this.load.image(key, path)` in the state's `preload()` first). Returns `null`/`undefined` if not found — the Raycaster logs a warning and treats that surface as absent, it does not throw. |
| `game.width` / `game.height` | `resizeToCamera()` only | Used to scale the internal low-res render up to the real canvas size. |

This coupling to Phaser is a known, deliberate limitation, not an
oversight — see [`raycaster-architecture.md`](raycaster-architecture.md#known-limitations).

### `level` (required)

Plain data describing the map. See [Level Data Format](#2-level-data-format) below.

### `options` (all optional)

| Option | Default | Meaning |
|---|---|---|
| `width` | `320` | Internal render width in pixels. This is **not** the on-screen size — call `resizeToCamera()` to scale up to the Phaser canvas. |
| `height` | `180` | Internal render height in pixels. |
| `cellSize` | `4` | World units per map cell. Player/sprite/light coordinates are in **world units**; map/cell lookups are in **cell units** (`world / cellSize`). |
| `wallHeight` | `2.5` | Fallback used two ways: (a) default `ceilingHeight` for a cell when neither the cell nor `level.defaultCeilingHeight` specify one, (b) base for the default `cameraHeight` (`wallHeight / 2`) when `cameraHeight` isn't given. |
| `cameraHeight` | `wallHeight / 2` | The eye-height offset above whatever floor an entity is standing on. Also the fallback for `camera.z` if a snapshot omits it. See `getEyeHeightWorld()`. |
| `fov` | `Math.PI / 3` (60°) | **Horizontal** field of view, in radians. This is the sole basis for `focalLength` and per-column ray angles — never derived from `height`. |
| `maxDistance` | `Math.max(level.width, level.height) * cellSize` | Rays stop tracing beyond this world distance. |
| `visibleIntervalCapacity` | `8` | Max number of separate visible vertical spans tracked per screen column (relevant only with many stacked partial-height walls in one column; the default is generous). |
| `debug` | `false` | Enables the debug counters (see [Diagnostics](#6-diagnostics)). No per-frame cost when `false`. |
| `debugSpriteAnchors` | `false` | Draws a small magenta cross at each sprite's projected anchor point (bottom-center), for visually checking sprite placement. |
| `debugLogEvery` | `0` (never) | If `debug: true` and this is e.g. `60`, dumps a `console.table` of the debug stats every 60th frame. |

---

## 2. Level Data Format

```js
export const myLevel = {
  width: 16,             // map width in cells (required)
  height: 16,             // map height in cells (required)

  defaultFloorHeight: 0,      // optional, else 0
  defaultCeilingHeight: 2.5,  // optional, else the `wallHeight` option
  defaultFogDistance: 20,     // optional, else 20
  defaultFogColor: { r, g, b }, // optional, else Raycaster.DEFAULT_FOG_COLOR

  map: [
    "1111111111111111",       // rows of characters, or arrays of strings/numbers
    "1000000000000001",       // each character is a cell id, looked up in `cells`
    // ...
  ],

  materials: {                // optional, named/reusable surfaces
    brick: { texture: "brickTexture", width: 2, height: 1.5 },
  },

  cells: {
    "0": { /* cell definition, see below */ },
    "1": { /* ... */ },
  },
};
```

- `map` rows may be strings (`"1000..."`, one char = one cell id) or
  arrays (`["1","0","0",...]` or `[1,0,0,...]` — coerced to strings).
- Any map position outside `[0, width) x [0, height)` resolves to cell id
  `"1"` — the conventional boundary-wall id. **Always define cell `"0"`**:
  it's also the final fallback if a referenced cell id has no entry in
  `cells`.

### Cell definition

```js
{
  floorHeight: 0,        // world Z of the floor
  ceilingHeight: 2.5,    // world Z of the ceiling
  wall: null,            // surface | string | null — renders a vertical face when set
  floor: null,           // surface | string | null — null means no floor drawn
  ceiling: null,         // surface | string | null — null means sky is visible
  blocking: undefined,   // bool, defaults to !!wall — see "steps" below
  fog: undefined,        // true | {distance, color} | falsy — see "fog zones" below
}
```

All fields are optional; omitted fields fall back to the defaults above.

**`wall` controls rendering, `blocking` controls collision — they are
independent.** A cell with a wall texture and `blocking: false` renders a
solid-looking block but does not stop movement — this is how to make a
walkable step or curb (see `3dtestLevel.js` cell `3` for a working
example: `ceilingHeight: 0.5, wall: {...}, blocking: false`). Standing on
such a cell rests on the *top* of the block (`ceilingHeight`), not its
base — see `getStandingHeight()` below.

**Fog zones are just whichever cells set `fog`.** There is no separate
region/polygon system.

```js
fog: true                                   // shorthand: use level/built-in defaults
fog: { distance: 20 }                       // override reach, use default color
fog: { distance: 20, color: { r, g, b } }   // full control
```

`distance` is the world distance at which the surface is fully the fog
color (linear ramp from 0 at distance 0). Falsy/omitted `fog` (the
default) costs nothing at render time.

### Surface format (`wall` / `floor` / `ceiling` / a light's implicit texture)

A surface value can be:

| Form | Example | Meaning |
|---|---|---|
| `null` / omitted | `ceiling: null` | No geometry drawn there. For `ceiling` specifically, this means the sky is visible — this is a real invariant of the renderer, not a missing-asset error. |
| String | `wall: "brick"` | Looked up in `level.materials.brick`. |
| Inline object | `wall: { texture: "wallTexture", width: 4, height: 4 }` | `texture` is the Phaser image cache key. `width`/`height` are the **world-space size the texture tile repeats over** — independent of the source image's pixel dimensions, and independent of `cellSize`. Both default to `cellSize` if omitted. |
| Material reference + override | `wall: { material: "brick", height: 3 }` | Resolves `level.materials.brick`, then shallow-merges the given object on top (so `height` here overrides the material's own `height`). |

---

## 3. Rendering a Frame

Two entry points; use whichever fits your call site.

### `render(player)` — compatibility wrapper

```js
raycaster.render(player); // player: {x, y, angle, z?, pitch?, fov?}
```

Equivalent to `renderSnapshot(createCameraSnapshot(player))`. Convenient,
but you cannot attach `sprites`/`lights`/`ambient` this way — use
`renderSnapshot` directly if you need those.

### `createCameraSnapshot(player)` + `renderSnapshot(camera)` — full control

```js
const camera = raycaster.createCameraSnapshot(player);
camera.sprites = mySprites;   // optional
camera.lights = myLights;     // optional
camera.ambient = 0.4;         // optional
raycaster.renderSnapshot(camera);
```

`createCameraSnapshot(player)` copies `x`, `y`, `angle` from `player` and
fills in defaults for the rest (`z ?? cameraHeight`, `pitch ?? 0`,
`fov ?? this.fov`). It does **not** copy sprites/lights/ambient — those
aren't part of "player", so attach them to the snapshot yourself before
calling `renderSnapshot`. You can also skip `createCameraSnapshot`
entirely and build the camera object yourself, as long as it has the
fields below.

### The `camera` object accepted by `renderSnapshot`

| Field | Required | Default | Notes |
|---|---|---|---|
| `x`, `y` | yes | — | World position. |
| `angle` | yes | — | Radians, `0` = looking along `+x`. |
| `z` | no | configured `cameraHeight` | Eye height in world Z. Change this per frame for crouching/jumping/standing on a raised floor. |
| `pitch` | no | `0` | Screen-space horizon offset in pixels (not degrees) — positive looks down. Does not affect ray tracing, only where the horizon line sits on screen. |
| `fov` | no | configured `fov` | Changing this rebuilds `focalLength` and per-column ray angles that frame — fine occasionally (e.g. a zoom/ADS effect), avoid changing every frame for no reason. |
| `sprites` | no | none | See [Sprites](#4-sprites). |
| `lights` | no | none | See [Lighting](#5-lighting). |
| `ambient` | no | `1` | See [Lighting](#5-lighting). |

`renderSnapshot` calls `updateProjection(camera)` for you — you never
need to call it directly.

---

## 4. Sprites

```js
camera.sprites = [
  {
    x: 28, y: 12, z: 0,       // world position; z is the sprite's base (floor-anchored) height
    texture: "Cobra",          // Phaser image cache key, loaded via preload()
    width: 1, height: 1,       // world-space size before scale (both optional, default 1)
    scale: 16,                 // number, or {x, y} — multiplies width/height
  },
];
```

This is **plain, disposable per-frame data** — the Raycaster does not
track sprite identity or lifecycle across frames. If an entity dies,
simply omit it from next frame's `camera.sprites` array; the Raycaster
has no idea it ever existed. Rebuild the array fresh (or reuse/mutate one
you own) every frame from whatever owns entity state.

- `texture` must resolve via `game.cache.getImage(texture)` — load it in
  `preload()` like any other image.
- Sprites with no `texture`, or fully behind the camera, are silently
  skipped.
- Sprites are depth-sorted (farthest first) and occluded per-pixel
  against wall depth automatically — you don't need to sort them
  yourself.
- `getBillboardWorldSize()`/`projectBillboard()` are the underlying
  math if you need to predict a sprite's screen position — see
  `getSpriteProjectionDiagnostic(camera, sprite)` for a ready-made debug
  helper that returns world/camera-space/screen values for one sprite.

---

## 5. Lighting

```js
camera.ambient = 0.35;   // baseline brightness multiplier, default 1 (no-op)
camera.lights = [
  {
    x: 28, y: 20, z: 3,             // world position
    radius: 20,                      // reach, in world units; 0 or omitted disables the light
    intensity: 1.5,                  // peak brightness added at distance 0, default 1
    tint: { r: 255, g: 180, b: 120 }, // 0-255 per channel, default white (a pure-brightness light)
  },
];
```

Also plain, disposable per-frame data — same contract as sprites: no
lifecycle owned by the renderer, rebuild the array every frame.

- **`camera.lights: []` and/or `camera.ambient: 1` (the defaults)
  reproduce completely unlit output.** An outdoor/unlit scene needs zero
  special-case code — just don't set these fields.
- Attenuation is linear distance falloff to zero at `radius`. **No
  shadows or occlusion** — a light shines through walls between it and
  the surface it's lighting. This is intentional (see
  [`plan.md`](plan.md), `P8-02`).
- Lights with `radius <= 0` or `intensity <= 0` are dropped before
  rendering — a cheap way to "turn off" a light without removing it from
  your array.
- Walls, floor/ceiling, and sprites are all lit consistently by the same
  `sampleLightRgb()` function.

---

## 6. Collision & World Queries

These are the methods a game loop calls to move an entity and keep its
height correct. All take **world-space** coordinates (the `World`
suffix); the non-`World` variants take cell-space coordinates directly
(`world / cellSize`) if you already have them.

| Method | Returns | Use for |
|---|---|---|
| `isWallWorld(x, y)` | `boolean` | Movement collision. `true` = blocked. Respects the cell's `blocking` flag, **not** raw `wall` presence — a step (`blocking: false`) returns `false` even though it renders a wall face. |
| `getStandingHeightWorld(x, y)` | `number` | The world Z an entity standing at `(x, y)` would rest on. For a walkable step (wall + `blocking: false`), this is the block's *top* (`ceilingHeight`); for an open cell, its `floorHeight`. |
| `getEyeHeightWorld(x, y)` | `number` | `getStandingHeightWorld(x, y) + cameraHeight` — the value to assign to `camera.z`/`player.z` in one call. |
| `getCell(x, y)` | cell object or `undefined` | Lower-level: the loaded cell (`floorHeight`, `ceilingHeight`, `wall`, `floor`, `ceiling`, `blocking`, `fog`) at **cell-space** `(x, y)`. Use for custom queries not covered above. |
| `castRay(originX, originY, angle)` | `{distance, side, mapX, mapY, hitX, hitY, cell}` or `null` | Hitscan: first cell whose raw `wall` is truthy along the ray (ignores `blocking` — a step still stops a hitscan ray). Useful for weapons/line-of-sight, not movement. |

Typical per-frame movement pattern (see `scripts/level-whiteroom.js`):

```js
if (!raycaster.isWallWorld(nextX, player.y)) player.x = nextX;
if (!raycaster.isWallWorld(player.x, nextY)) player.y = nextY;
player.z = raycaster.getEyeHeightWorld(player.x, player.y);
```

---

## 7. Diagnostics

| Method / Option | Purpose |
|---|---|
| `debug: true` (constructor option) | Enables the counters below. `false` (default): all counters stay zero, no per-frame cost. |
| `getDebugStats()` | Returns a snapshot object: `ddaSteps`, `segments`, `wallSegments`, `wallPixels`, `planePixelsTested`, `planePixelsDrawn`, `visibleIntervalChecks`, `visibleIntervals`, `frameMs`, `traceMs`, `uploadMs`. |
| `debugLogEvery: N` | Auto-`console.table`s the stats every `N`th frame (requires `debug: true`). |
| `getMaterialStats()` | `{entries, hits, misses}` for the texture/material cache. |
| `debugSpriteAnchors: true` | Draws a magenta cross at each sprite's projected anchor — useful for spotting sprite placement bugs. |
| `getSpriteProjectionDiagnostic(camera, sprite)` | Returns world/camera-space/screen values for one sprite without drawing it — useful for unit tests or debugging projection issues. |

If you're chasing "nothing is rendering" or "my new per-cell property
has no visible effect," check `planePixelsDrawn`/`wallPixels` first —
it's easy to build a test scene so small or close that the surface you
care about is never actually visible (this bit an internal integration
test during development — see [`plan.md`](plan.md)'s fog/lighting
entries).

---

## 8. Lifecycle

```js
raycaster.resizeToCamera(); // call once after construction (and again if the Phaser canvas resizes)
// ...
raycaster.destroy();        // call from the game state's shutdown()
```

There is no way to swap `level` on an existing instance — construct a
new `Raycaster` to change levels.

---

## 9. Minimal End-to-End Example

```js
import { Raycaster } from "./system/Raycaster.js";
import { myLevel } from "./data/myLevel.js";

export class MyState {
  preload() {
    this.load.image("wallTexture", "assets/textures/wall.png");
    this.load.image("floorTexture", "assets/textures/floor.png");
  }

  create() {
    this.raycaster = new Raycaster(this.game, myLevel, {
      width: 320,
      height: 180,
      cellSize: 4,
      cameraHeight: 4,
      fov: Math.PI / 3,
    });
    this.raycaster.resizeToCamera();

    this.player = { x: 14, y: 14, angle: 0 };
  }

  update() {
    // ... move this.player based on input, using isWallWorld() for collision ...
    this.player.z = this.raycaster.getEyeHeightWorld(this.player.x, this.player.y);

    const camera = this.raycaster.createCameraSnapshot(this.player);
    camera.sprites = this.mySprites;   // optional
    camera.lights = this.myLights;     // optional
    camera.ambient = 0.4;              // optional
    this.raycaster.renderSnapshot(camera);
  }

  shutdown() {
    this.raycaster.destroy();
  }
}
```

---

## 10. Common Gotchas

- **World units vs. cell units.** Player/sprite/light coordinates are
  world units. Map/`getCell` lookups are cell units (`world / cellSize`).
  Mixing these up is the most common integration bug — prefer the
  `*World` methods.
- **`fov` is horizontal**, always. Never derive anything from `height`
  when working with FOV/focal length — this was a real, shipped bug
  (see [`plan.md`](plan.md)'s sprite-arc entries) and the reason
  `raycaster-architecture.md` calls this out explicitly.
- **`width`/`height` options are internal render resolution**, not the
  visible canvas size. Call `resizeToCamera()`.
- **`ceiling: null` is intentional**, not a missing texture — it means
  "sky is visible here."
- **Sprites/lights are not entities.** Don't hand the Raycaster ECS
  objects, Phaser sprites, or anything with identity/lifecycle — build a
  fresh plain-data array each frame from whatever owns that state.
- **`blocking` and `wall` are independent.** Don't assume every wall
  blocks movement, or that every non-blocking cell is empty — check
  both if your feature cares about either.
