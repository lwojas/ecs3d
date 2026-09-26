# Raycaster

## Project

A Phaser 2 browser FPS with a custom ECS/gameplay architecture and custom rendering.

Use the following areas as the starting points for understanding the codebase:

- `/docs` — architecture and development documentation
- `/scripts` — application and game logic
- `/scripts/system` — ECS systems
- `/scripts/components` — ECS components
- `/scripts/api/rules` — gameplay management and orchestration
- `/scripts/api/session/MapWorld.js` — interface to the Phaser 2 runtime; instantiates and updates systems
- `/scripts/system/Raycaster.js` — raycaster rendering and world inspection API
- `/scripts/system/CameraRenderer.js` — rendering interface; systems push rendering work into the appropriate rendering pools

## Architecture

- Gameplay logic should remain independent of Phaser and rendering where practical.
- `MapWorld` is the runtime boundary where systems are instantiated and updated.
- Systems implement gameplay behaviour; components hold entity state.
- `Raycaster` provides the world/rendering-facing raycaster API.
- `CameraRenderer` provides rendering pools used by systems.
- Prefer existing architecture and patterns over introducing parallel mechanisms.

## Development conventions

For creating or modifying ECS systems and components, follow the conventions documented in:

`/docs/system-and-component-style.md`

When working on a specific area, consult the relevant documentation in `/docs` before making architectural changes.

Source code is authoritative if documentation and implementation disagree.

## Working approach

Before changing code:

1. Inspect the relevant existing implementation.
2. Trace the current behaviour and dependencies.
3. Make the smallest coherent change that fits the existing architecture.
4. Run relevant tests and check the resulting diff.
