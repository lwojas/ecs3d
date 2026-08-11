# Raycaster Engine --- Goals & Roadmap

## Project purpose

This project is a small, deliberately understandable 2.5D raycasting
engine built in JavaScript/Phaser 2.

The goal is **not** to build a commercially useful game engine or
reproduce a modern engine. The goal is to explore the techniques behind
classic software-rendered shooters and gradually evolve a compact
renderer into a small, coherent engine.

The project should favour:

-   Simple systems with clear responsibilities.
-   Data-oriented interfaces where practical.
-   Understandable rendering algorithms over opaque abstractions.
-   Small, composable features rather than a large framework.
-   Separation between rendering, gameplay, ECS, input, collision and
    AI.
-   Level data that can eventually be authored by a visual editor.
-   An architecture that could eventually allow the rendering core to be
    ported to WebAssembly.

The renderer should remain useful as a technical experiment even if the
surrounding game systems change completely.

------------------------------------------------------------------------

# Core architectural goal

The raycaster is a **renderer, not a game system**.

It should eventually accept a small amount of raw, renderer-oriented
data:

``` text
ECS / Game Systems
        |
        | build render state
        v
  Render Snapshot
        |
        v
   Raycaster
        |
        v
    Framebuffer
```

The raycaster should not know about:

-   Entities
-   Components
-   Player objects
-   Input
-   AI
-   Weapons
-   Health
-   Gameplay rules
-   Collision decisions
-   Game state
-   Phaser ECS/application systems

The game layer owns those concerns and translates them into the data
required by the renderer.

## Renderer-facing interface

The eventual interface should be based on plain data rather than ECS
objects.

Conceptually:

``` js
{
  camera: {
    x,
    y,
    z,
    angle,
    pitch,
    fov
  },

  world: {
    cells: [...],
    materials: [...]
  },

  // Later:
  sprites: [...],
  lights: [...],
  sky: {...}
}
```

The exact structure is deliberately not fixed yet. It should evolve
alongside the renderer.

The important rule is that the raycaster receives **the raw information
needed to draw the frame**, rather than being given access to the
application's world model.

This boundary is important for a future WebAssembly experiment:

``` text
JavaScript
    |
    | Render data
    v
WebAssembly renderer
    |
    v
Framebuffer
```

The JavaScript side can remain responsible for ECS and gameplay while
the rendering core can potentially be moved to WASM later.

------------------------------------------------------------------------

# Current renderer

The renderer currently supports or is being developed around:

-   Grid-based level geometry.
-   PNG-derived maps during early experimentation.
-   Data-driven cell-based levels.
-   Multiple wall materials.
-   Independent physical texture dimensions.
-   Continuous wall texture mapping across cell boundaries.
-   Variable wall heights.
-   Floor textures.
-   Floor texture mapping.
-   Ceiling textures.
-   Basic open/closed ceiling concepts.
-   Configurable world cell size.
-   Configurable FOV.
-   Configurable render resolution.
-   Software-style column raycasting.

The renderer currently operates at a deliberately low internal
resolution and can scale its output to the Phaser camera.

The intention is to keep this small and inspectable rather than
immediately optimising it into an opaque implementation.

------------------------------------------------------------------------

# Engine goals

## 1. Geometry

Build a useful 2.5D geometry model capable of representing classic
shooter environments.

### Planned

-   Variable floor heights.
-   Variable ceiling heights.
-   Variable wall heights.
-   Walkable steps.
-   Raised platforms.
-   Lowered floors.
-   Different floor heights within the same map.
-   Different ceiling heights within the same map.
-   Independent wall geometry.
-   Doors.
-   Windows and wall openings.
-   Lifts/elevators.
-   Stairs.
-   Bridges/platforms where practical.
-   Sector/room-style geometry if the grid representation eventually
    needs to evolve.

### Important distinction

Geometry and collision should not be the same concept.

A low wall or height difference may be:

-   Walkable.
-   A step.
-   A blocking wall.
-   A decorative surface.

The renderer should describe geometry. Gameplay/collision systems should
decide what the player or entities can traverse.

For example:

``` text
floor height difference <= max step
    -> potentially walkable

large height difference
    -> potentially blocking

wall geometry
    -> rendered regardless of gameplay collision rules
```

The exact collision model belongs outside the renderer.

------------------------------------------------------------------------

# 2. Materials and textures

Materials should be independent from geometry.

A material should eventually describe things such as:

``` js
{
  texture: "brick",
  worldWidth: 2,
  worldHeight: 2.5
}
```

This allows the renderer to distinguish:

``` text
Geometry:
    wall is 8 metres long

Material:
    texture represents 2 metres

Result:
    texture repeats four times
```

### Planned

-   Multiple wall textures.
-   Multiple floor textures.
-   Multiple ceiling textures.
-   Independent physical texture dimensions.
-   Texture tiling.
-   Different materials on adjacent wall segments.
-   Animated textures.
-   Optional material properties for transparency/emissive behaviour
    later.
-   Material caching/loading independent of gameplay entities.

Texture scale must remain independent from map cell size.

------------------------------------------------------------------------

# 3. Floors and ceilings

The floor and ceiling renderer should become first-class parts of the
engine rather than extensions of wall rendering.

### Planned

-   Correct perspective floor casting.
-   Correct perspective ceiling casting.
-   Independent floor materials.
-   Independent ceiling materials.
-   Repeating textures.
-   Different floor heights.
-   Different ceiling heights.
-   Open ceilings.
-   Sky rendering.
-   Sky textures / primitive skybox.
-   Eventually more advanced sky behaviour if useful.

A room should be able to have, conceptually:

``` text
floor:   concrete
ceiling: plaster
```

or:

``` text
floor:   tiles
ceiling: null
```

where `null` means the renderer exposes the sky.

------------------------------------------------------------------------

# 4. Camera

The camera should eventually be independent from the player/game entity.

Conceptually:

``` js
{
  x,
  y,
  z,
  angle,
  pitch,
  fov
}
```

### Planned

-   Camera position.
-   Camera height.
-   Camera angle.
-   FOV.
-   Looking up/down.
-   Camera pitch.
-   Player-height integration supplied by the game layer.
-   Eventually jumping/crouching support through camera state rather
    than renderer-owned gameplay logic.

The raycaster should only consume camera state.

It should never decide how the camera moves.

------------------------------------------------------------------------

# 5. Collision and movement boundary

Collision belongs to the game/ECS side.

The renderer may expose useful geometry queries if needed, but it should
not implement movement rules.

For example:

``` text
Game / Collision System
        |
        | asks about geometry
        v
Raycaster / World Geometry
```

The renderer must not contain:

-   Player movement.
-   Step-up rules.
-   Gravity.
-   Jumping.
-   Input handling.
-   Physics state.

This separation will make the renderer easier to port to WASM.

------------------------------------------------------------------------

# 6. Sprites and objects

Sprites are a major planned feature.

The renderer should eventually support classic billboarded objects such
as:

-   Enemies.
-   Weapons.
-   Pickups.
-   Decorations.
-   Particles.
-   Projectiles.
-   Interactive objects.

The game/ECS layer should provide raw sprite render data rather than
entities.

Conceptually:

``` js
{
  x,
  y,
  z,
  texture,
  width,
  height,
  frame
}
```

### Planned sprite features

-   Billboard sprites.
-   Perspective scaling.
-   Distance sorting.
-   Wall occlusion.
-   Depth-buffer testing.
-   Sprite clipping.
-   Animated sprite frames.
-   Directional sprites.
-   Optional vertical offsets.
-   Sprite lighting/shading later.

The renderer should not know that a sprite is an `EnemyComponent`.

It should only know:

> Draw this image at this world-space position with these dimensions.

------------------------------------------------------------------------

# 7. Depth buffer and visibility

A per-column depth buffer should become a core renderer primitive.

For example:

``` text
column 0 -> wall distance
column 1 -> wall distance
column 2 -> wall distance
...
```

This can then be used for:

-   Sprite occlusion.
-   Object visibility.
-   Wall clipping.
-   Potential future effects.
-   Debugging visibility.

Later, the same spatial information may be useful to game systems, but
gameplay systems should consume a defined interface rather than reaching
into renderer internals.

------------------------------------------------------------------------

# 8. Lighting

Lighting should eventually become a proper renderer feature.

The existing project already has a separate 2D lighting system. The
raycaster should explore the equivalent concepts in a 2.5D environment
without coupling itself to that gameplay-side implementation.

### Planned

-   Ambient/world lighting.
-   Per-wall lighting.
-   Distance attenuation.
-   Sector/room lighting.
-   Point lights.
-   Optional coloured lights.
-   Dynamic lights.
-   Muzzle flashes.
-   Explosions.
-   Light-aware sprites.
-   Simple lightmaps or precomputed lighting if useful.
-   Fog.

The first implementation should favour simple calculations over a
complex physically-based lighting model.

------------------------------------------------------------------------

# 9. Fog and distance effects

Classic engines frequently used fog both aesthetically and as a
practical visibility limit.

### Planned

-   Configurable draw distance.
-   Distance fog.
-   Colour/tint controlled by the environment.
-   Sky/fog integration.
-   Optional per-sector fog settings.

Fog should remain a rendering effect. It should not define gameplay
visibility.

------------------------------------------------------------------------

# 10. Sky

Support environments without a ceiling.

Initial implementation:

``` text
open ceiling
    -> sky colour / primitive sky
```

Later:

-   Sky texture.
-   Cylindrical or panoramic sky.
-   Sky movement/parallax.
-   Skybox-style rendering if useful.

The sky should be another renderer input rather than a gameplay object.

------------------------------------------------------------------------

# 11. Level representation

The project started with black/white PNG maps.

That was useful for getting the first renderer running, but the
long-term representation should be data-driven.

The current direction is cell-based level data containing geometry and
material properties.

Conceptually:

``` js
{
  floor: {
    height: 0,
    material: "concrete"
  },

  ceiling: {
    height: 2.5,
    material: "plaster"
  },

  walls: {
    // Current representation may evolve.
  }
}
```

The representation should eventually support independent wall segments
because a cell's four edges may have different materials or heights.

The renderer should not assume that a cell is inherently a solid wall.

------------------------------------------------------------------------

# 12. Visual level editor

A visual editor is a longer-term goal, not an immediate priority.

The editor should eventually allow level designers to:

-   Paint floor materials.
-   Paint wall materials.
-   Paint ceiling materials.
-   Set floor heights.
-   Set ceiling heights.
-   Set wall heights.
-   Define rooms/sectors.
-   Place sprites/entities.
-   Select materials from a palette.
-   Preview the level in the renderer.

The editor should edit the same plain level data consumed by the
renderer.

The renderer should not depend on the editor.

The data model should stabilise before building the editor in earnest.

------------------------------------------------------------------------

# 13. ECS integration

The ECS remains the application's gameplay architecture.

The raycaster should eventually have a thin adapter between ECS state
and renderer state.

For example:

``` text
EntityManager
     |
     +-- PositionComponent
     +-- SpriteComponent
     +-- LightComponent
     +-- ...
            |
            v
      Render Adapter
            |
            v
     RenderSnapshot
            |
            v
       Raycaster
```

The adapter translates ECS components into plain render data.

The renderer never receives the ECS objects themselves.

Potential render data:

``` js
{
  camera: {...},

  world: {
    cells: [...],
    materials: [...]
  },

  sprites: [...],

  lights: [...],

  sky: {...}
}
```

This should remain intentionally boring and serialisable where
practical.

That property is valuable for:

-   Debugging.
-   Recording/replaying frames.
-   Testing.
-   Worker-based rendering experiments.
-   WebAssembly.
-   Potential future networking/replay systems.

------------------------------------------------------------------------

# 14. WebAssembly exploration

A long-term technical goal is to experiment with moving the
performance-critical renderer to WebAssembly.

This is not currently an optimisation requirement.

The purpose is to explore:

-   What the boundary between JavaScript and native-like code looks
    like.
-   How much data should cross the JS/WASM boundary.
-   Whether the raycasting workload benefits from WASM.
-   How a framebuffer can be shared or transferred.
-   Whether data-oriented rendering structures make a meaningful
    difference.

The architecture should therefore avoid making the renderer dependent on
JavaScript objects with complicated references.

A possible eventual architecture:

``` text
                 JavaScript
                     |
              ECS + Gameplay
                     |
              Render Snapshot
                     |
              JS/WASM boundary
                     |
                     v
              WASM Raycaster
                     |
                     v
                Framebuffer
                     |
                     v
                 Phaser
```

The WASM port should be an experiment enabled by the architecture, not a
constraint that makes the current JavaScript implementation unpleasant
to work with.

------------------------------------------------------------------------

# 15. Performance philosophy

Performance matters, but premature optimisation is not the goal.

The initial implementation should favour:

1.  Correctness.
2.  Clear algorithms.
3.  Simple data structures.
4.  Easy experimentation.
5.  Profiling.
6.  Targeted optimisation.

Only after profiling should we investigate:

-   Fewer ray calculations.
-   Precomputed tables.
-   Lookup tables.
-   Visibility zones.
-   Spatial partitioning.
-   DDA optimisation.
-   Typed arrays.
-   Worker threads.
-   WASM.
-   WebGL/GPU rendering.

The project is primarily an exploration of the techniques, so being able
to understand the implementation is itself a feature.

------------------------------------------------------------------------

# Planned engine progression

## Phase 1 --- Core renderer

-   [x] Raycast walls.
-   [x] Grid-based level.
-   [x] Configurable cell/world scale.
-   [x] Wall textures.
-   [x] Continuous wall texture mapping.
-   [x] Multiple wall materials.
-   [x] Variable wall heights.
-   [x] Floor textures.
-   [x] Ceiling textures.
-   [ ] Robust floor/ceiling perspective.
-   [ ] Open ceiling / sky.
-   [ ] Independent camera Z.

## Phase 2 --- Geometry

-   [ ] Proper floor/ceiling height model.
-   [ ] Walkable steps.
-   [ ] Separate rendering and collision concepts.
-   [ ] Independent wall segments.
-   [ ] Doors.
-   [ ] Windows/openings.
-   [ ] Stairs.
-   [ ] Lifts/platforms.
-   [ ] More complex room/sector geometry.

## Phase 3 --- Objects and visibility

-   [ ] Depth buffer.
-   [ ] Billboard sprites.
-   [ ] Sprite occlusion.
-   [ ] Sprite animation.
-   [ ] Directional sprites.
-   [ ] Object rendering interface.
-   [ ] Particles/projectiles.

## Phase 4 --- Lighting and atmosphere

-   [ ] Ambient lighting.
-   [ ] Distance lighting.
-   [ ] Dynamic lights.
-   [ ] Light-aware sprites.
-   [ ] Fog.
-   [ ] Open sky.
-   [ ] Sky textures.
-   [ ] Environmental lighting.

## Phase 5 --- Engine/world features

-   [ ] Sectors/rooms.
-   [ ] Portals.
-   [ ] Animated textures.
-   [ ] More advanced doors.
-   [ ] Environmental effects.
-   [ ] More complex geometry where justified.

## Phase 6 --- Tooling

-   [ ] Stable level data format.
-   [ ] Material library.
-   [ ] Visual level editor.
-   [ ] Map preview/debug tools.
-   [ ] Geometry visualisation.
-   [ ] Renderer debugging tools.

## Phase 7 --- Technical experiments

-   [ ] Profiling.
-   [ ] Typed-array data structures where useful.
-   [ ] Visibility optimisation.
-   [ ] Spatial partitioning.
-   [ ] WebAssembly renderer experiment.
-   [ ] Compare JS vs WASM performance.
-   [ ] Investigate worker/GPU rendering only if interesting.

------------------------------------------------------------------------

# Guiding principle

The project should remain a small engine that can be understood from end
to end.

The goal is not to recreate Unreal Engine.

The goal is to be able to look at a frame and understand:

``` text
How did this ray find that wall?

How did we determine its height?

How did we choose its texture?

How did the floor get projected?

Why is this sprite behind that wall?

How did lighting affect this surface?

Where did the world data come from?

How does ECS state become render state?
```

If adding a feature makes those questions harder to answer, prefer a
simpler design unless the complexity is genuinely necessary.

Complex scenes should emerge from **simple interacting systems**, rather
than from making each individual system complicated.
