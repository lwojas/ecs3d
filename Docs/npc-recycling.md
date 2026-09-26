# NPC/Entity Recycling

This document explains the entity recycling mechanism introduced for wave spawning (`WaveRules` + `SpawnGroup`) and intended for reuse by any other spawn-driven feature — alarms, scripted encounters, multiplayer respawns, and future `SpawnGroup` consumers.

## Problem

Repeatedly `createEntity()`-ing and discarding NPCs on every wave is wasteful, and discarded entities were never actually removed — `disable()` only ever toggled component `.enabled` flags, so a "dead" entity stayed fully resident in `EntityManager` forever with no way to give it back to a future spawn.

The goal: when a spawn request can be satisfied by an existing disabled entity of the right prefab, reuse it instead of constructing a new one — without leaking any state from its previous life.

```text
spawn request
    ↓
find suitable disabled entity
    ↓
reset entity to its prefab's canonical state
    ↓
apply spawn-specific configuration/modifiers
    ↓
enable entity
```

If no suitable disabled entity exists, fall back to constructing one from the prefab as before.

## Responsibilities

| Concern                              | Owner                          |
| ------------------------------------ | ------------------------------- |
| Encounter membership (who's active)  | `SpawnGroup.entities`           |
| Reusable disabled entities           | `EntitySpawner.recyclable`      |
| Resetting an entity to prefab state  | `PrefabFactory.resetEntity()`   |
| Deciding *when* to spawn/release     | Callers (`WaveRules`, etc.)     |

Each of these already existed for a related reason (`SpawnGroup` for encounter tracking, `EntitySpawner` for construction) — recycling was added as new capability on those same objects, not a new class or subsystem.

### `SpawnGroup` — encounter membership only

Unchanged in shape. `SpawnGroup.entities` remains the single, authoritative list of "what's currently active in this encounter." The only addition is `release(entity)`:

```js
release(entity) {
  this.untrack(entity);
  this.spawner.release(entity);
}
```

`SpawnGroup` still knows nothing about pooling — it just forwards to its spawner. It stays a thin, local ownership abstraction usable by waves, alarms, or scripted encounters alike.

### `EntitySpawner` — the reusable pool

`EntitySpawner` is already scoped to one map/world (a fresh instance is built per map, same as `SpawnGroup` assumes of it), so it's the natural place to hold a shared pool: any `SpawnGroup` built against the same spawner benefits automatically, without a global registry.

```js
this.recyclable = new Map(); // prefabId -> Entity[]
```

- `release(entity)` — disables the entity and files it under `recyclable[entity.prefabId]`.
- `acquireRecyclable(prefabId)` — pops a disabled entity for that prefab, or returns `null`.
- `spawn(request)` — tries `acquireRecyclable()` first (unless the request names a specific `uniqueId`); on a hit it resets and re-enables the existing entity instead of calling `prefabFactory.createEntity()`.

```js
const recycled = uniqueId ? null : this.acquireRecyclable(resolvedType);
if (recycled) {
  this.prefabFactory.resetEntity(recycled, finalComponents);
  recycled.enable();
  return recycled;
}
return this.prefabFactory.createEntity({ type: resolvedType, uniqueId, components: finalComponents });
```

A request with an explicit `uniqueId` never draws from the pool — reusing a pooled entity for a specific requested identity would mean reassigning its `.id` (and `EntityManager.byId` entry), which nothing currently needs and this mechanism doesn't attempt.

### `PrefabFactory` — the reset

Resetting an entity reuses the exact same convention `createEntity()` already relies on: every component class's constructor takes `(entity, data)` and derives 100% of its runtime state from that call alone. Re-invoking a component's constructor is therefore a complete reset, not a partial one — there's no reflection or generic cloning involved.

`createEntity()`'s original merge-and-construct logic was split into two reusable pieces:

```js
// default components ⊕ request components ⊕ any saved inventory snapshot
buildComponents(type, components, uniqueId)

// (re)constructs each named component from scratch and installs it via
// entity.addComponent(), which replaces whatever was there before
applyComponents(entity, mergedComponents)
```

`createEntity()` composes both against a brand-new `Entity`. `resetEntity(entity, components)` composes both against an **existing** entity, using `entity.prefabId` to look up canonical defaults — never the entity's own stale `snapshot` from its previous spawn:

```js
resetEntity(entity, components) {
  const mergedComponents = this.buildComponents(entity.prefabId, components, entity.id);
  entity.snapshot = mergedComponents;
  this.applyComponents(entity, mergedComponents);
  return entity;
}
```

Identity (`entity.id`, `entity.tempId`) and `EntityManager` registration are untouched — only component state is replaced.

## Why this reset boundary is complete

Every NPC-relevant component was checked against this rule ("does the constructor derive all state from `(entity, data)` alone, with nothing surviving from a prior life unless the caller re-supplies it"):

`HealthComponent`, `AIComponent`, `MovementComponent`, `HitReactionComponent`, `PatrolComponent`, `HuntingComponent`, `CombatMovementComponent`, `AnimationComponent`, `SpriteComponent`, `ActorComponent`, `InventoryComponent`, `SpawnComponent`, `CollisionComponent` all satisfy it — health, AI target/awareness/timers, patrol index, hit-reaction state/timers, animation frame/elapsed, combat-movement phase, inventory items, etc. all live only on the component instance being discarded and reconstructed.

Systems don't need to be told about a reset: `MovementSystem`, `CollisionSystem`, `SpriteSystem`, `AnimationSystem`, `AISystem`, and `CombatSystem.applyHitReaction` all already gate their per-frame work on each component's own `.enabled` flag rather than on any cached notion of the entity's history, so a freshly-reset, re-enabled entity is picked back up correctly the next frame with no special-casing.

### A latent gap this closed

`Entity.disable()`/`enable()` toggled every component's `.enabled` but never `entity.isEnabled` itself. That field is read in exactly two places:

- `EntityManager.updateEntityLists()` / `registerSystem()` — proven harmless to flip, since that function only ever **adds** an entity to a system's list and never removes one; every system already relies on per-component `.enabled` for frame-to-frame gating, not list membership.
- `AISystem.getStickyTarget()` / `getStickyHuntTarget()` — these check `targetEntity.isEnabled` expecting it to reflect the target's actual liveness. Since it was never set to `false`, the check was dead code.

This matters specifically for recycling: once a killed entity's object is handed to a different spawn, any other AI's stale `ai.targetEntity` reference to it must stop resolving as a valid sticky target. `disable()`/`enable()` now also flip `entity.isEnabled`, closing that gap.

## Lifecycle wiring (`entity.killed` → reusable)

`CombatSystem` still emits the single `entity.killed` message on the alive→dead transition; no new event was introduced.

```js
// WaveRules.js
onEntityKilled(gameplay, message) {
  const victim = message.target.entity;
  victim.disable();
  // ...branch into onPlayerKilled / onEnemyKilled...
}

onEnemyKilled(gameplay, enemy, killer) {
  this.enemies.release(enemy); // untrack + return to the spawner's pool
  // ...scoring, wave-advance...
}
```

Player death is untouched — players still go through `victim.disable()` and the existing `player.respawn` action / `EntitySpawner.respawn()`, which is a distinct, simpler seam (no prefab reset, no pooling) that this task did not change.

## Concrete example

```text
spawn "grunt" (courtyard)      → new Entity #1, prefabId "grunt"
grunt #1 is killed              → WaveRules.onEnemyKilled
                                    → enemies.release(#1)
                                       → SpawnGroup.untrack(#1)
                                       → spawner.release(#1): #1.disable(), filed under recyclable["grunt"]
spawn "grunt" again (courtyard) → spawner.spawn()
                                    → acquireRecyclable("grunt") pops #1
                                    → prefabFactory.resetEntity(#1, thisSpawn'sComponents)
                                         rebuilds every component of #1 from "grunt"'s prefab defaults,
                                         then layers this spawn's spawnPoint/modifiers on top
                                    → #1.enable()
                                    → same Entity object, fully fresh state, tracked by the new spawn() call
```

## Deliberately not reset

- **`entity.id` / `entity.tempId`** — identity stays stable across reuse; only content is renewed. Changing it would desync `EntityManager.byId`.
- **`entity.entityManager`** — infrastructure (a `ServiceLocator` reference), not gameplay state.
- **`EntityStore.inventories`** (persistent, `uniqueId`-keyed inventory snapshots used for player respawn/persistence) — untouched. Pooled NPCs are spawned without a `uniqueId`, so this lookup is inert for them; player inventory persistence is a separate, unrelated lifecycle this task didn't touch.
- **Any component outside the merged prefab-defaults/spawn-time `components`** — `applyComponents()` only touches components present in that merge. Nothing in the current NPC component set is attached any other way, but it's the actual boundary of what a reset covers.

## What was intentionally not built

Per the guidance this feature was scoped against:

- No generic/reflection-based "reset everything" mechanism — resets go through each component's own constructor, the same convention `createEntity()` already used.
- No pool hierarchy, factory layer, or dependency injection — `recyclable` is a plain `Map` on `EntitySpawner`.
- No new update-loop system or per-frame pool maintenance — `acquireRecyclable`/`release` are called explicitly by spawn/kill code paths, never ticked.
- No new death event — the existing `entity.killed` message drives the whole lifecycle.
- No change to wave progression, rules architecture, or player respawn.
