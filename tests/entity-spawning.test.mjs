import assert from "node:assert/strict";
import { EventBus } from "../scripts/services/EventBus.js";
import { EntityManager } from "../scripts/services/EntityManager.js";
import { PrefabFactory } from "../scripts/services/PrefabFactory.js";
import { EntitySpawner } from "../scripts/services/EntitySpawner.js";

// EntityManager/Entity resolve services via ServiceLocator at
// construction time -- set that up once, exactly like a real level does,
// but with no DOM/Phaser/Raycaster involved.
new EventBus("game");
const entityManager = new EntityManager();

const componentDefaults = {
  npc: {
    MovementComponent: {},
    HealthComponent: { maximum: 100 },
  },
};

const prefabFactory = new PrefabFactory(entityManager, componentDefaults);

// A minimal stand-in for Raycaster -- only the one method EntitySpawner
// actually calls.
const fakeRaycaster = {
  cellSize: 4,
  cellToWorld(cellX, cellY) {
    return { x: cellX * this.cellSize, y: cellY * this.cellSize };
  },
};

const mapData = {
  spawnPoints: {
    courtyard: { cellX: 5, cellY: 3.5, angle: 1.5 },
    zoneA: { cellX: 2, cellY: 2, angle: 0 },
    zoneB: { cellX: 8, cellY: 2, angle: 0 },
  },
  spawnZones: {
    twoSpots: ["zoneA", "zoneB"],
  },
};

function makeSpawner() {
  return new EntitySpawner({ prefabFactory, raycaster: fakeRaycaster, mapData });
}

function testGetDefaultComponentsReturnsEmptyForUnknownType() {
  assert.deepEqual(prefabFactory.getDefaultComponents("unknown"), {});
  assert.deepEqual(prefabFactory.getDefaultComponents("npc"), componentDefaults.npc);
}

function testCreateEntityMergesDefaultsAndOverrides() {
  const entity = prefabFactory.createEntity({
    type: "npc",
    uniqueId: "merge_test",
    components: { HealthComponent: { maximum: 50 } },
  });

  assert.equal(entity.getComponent("HealthComponent").maximum, 50);
  assert.ok(entity.getComponent("MovementComponent"), "default MovementComponent should still be added");
}

function testSpawnResolvesNamedPointToWorldPosition() {
  const spawner = makeSpawner();
  const entity = spawner.spawn({ type: "npc", uniqueId: "spawn_point_test", spawnPoint: "courtyard" });

  const movement = entity.getComponent("MovementComponent");
  assert.equal(movement.x, 20); // 5 * cellSize(4)
  assert.equal(movement.y, 14); // 3.5 * cellSize(4)
  assert.equal(movement.angle, 1.5);
  assert.equal(entity.getComponent("SpawnComponent").point, "courtyard");
}

function testSpawnZoneRoundRobinsThroughPoints() {
  const spawner = makeSpawner();
  const first = spawner.spawn({ type: "npc", uniqueId: "zone_1", spawnZone: "twoSpots" });
  const second = spawner.spawn({ type: "npc", uniqueId: "zone_2", spawnZone: "twoSpots" });
  const third = spawner.spawn({ type: "npc", uniqueId: "zone_3", spawnZone: "twoSpots" });

  assert.equal(first.getComponent("SpawnComponent").point, "zoneA");
  assert.equal(second.getComponent("SpawnComponent").point, "zoneB");
  assert.equal(third.getComponent("SpawnComponent").point, "zoneA"); // wraps
}

function testHealthMultiplierScalesMaximumOnly() {
  const spawner = makeSpawner();
  const entity = spawner.spawn({
    type: "npc",
    uniqueId: "modifier_test",
    modifiers: { healthMultiplier: 2 },
  });

  const health = entity.getComponent("HealthComponent");
  assert.equal(health.maximum, 200); // 100 (default) * 2
  assert.equal(health.current, 200); // fresh spawn: current starts at maximum
}

function testSpawnAuthoredAcceptsEntityDataShapeDirectly() {
  const spawner = makeSpawner();
  const [entity] = spawner.spawnAuthored([
    {
      type: "npc",
      uniqueId: "authored_test",
      components: { SpawnComponent: { point: "courtyard" } },
    },
  ]);

  const movement = entity.getComponent("MovementComponent");
  assert.equal(movement.x, 20);
  assert.equal(movement.y, 14);
}

function testRespawnResetsPositionHealthAndReenables() {
  const spawner = makeSpawner();
  const entity = spawner.spawn({ type: "npc", uniqueId: "respawn_test", spawnPoint: "zoneA" });

  const movement = entity.getComponent("MovementComponent");
  const health = entity.getComponent("HealthComponent");

  // Simulate death: moved away, damaged to 0, disabled.
  movement.x = 999;
  movement.y = 999;
  health.current = 0;
  entity.disable();

  assert.equal(health.enabled, false, "sanity check: disable() should have run");

  spawner.respawn(entity);

  assert.equal(movement.x, 8); // 2 * cellSize(4), back to zoneA
  assert.equal(movement.y, 8);
  assert.equal(health.current, health.maximum);
  assert.equal(health.enabled, true);
  assert.equal(movement.enabled, true);
}

function testDuplicateUniqueIdWarnsAndCreatesASecondEntity() {
  // Regression: authoring the same uniqueId twice (e.g. a copy-pasted
  // entity entry) used to fail silently -- the second entity would win
  // any id-keyed lookup while the first became an orphan still fully
  // alive in every system that tracks it (a static, never-updated
  // collider, for anything with a CollisionComponent).
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => (warned = true);

  const first = prefabFactory.createEntity({ type: "npc", uniqueId: "dup_test" });
  const second = prefabFactory.createEntity({ type: "npc", uniqueId: "dup_test" });

  console.warn = originalWarn;

  assert.equal(warned, true, "should warn loudly about the duplicate uniqueId");
  assert.notEqual(first, second, "still two distinct Entity objects, not deduped silently");
  assert.equal(first.id, second.id);
}

const tests = [
  ["PrefabFactory.getDefaultComponents returns the right template", testGetDefaultComponentsReturnsEmptyForUnknownType],
  ["PrefabFactory.createEntity still merges defaults and overrides", testCreateEntityMergesDefaultsAndOverrides],
  ["EntitySpawner.spawn resolves a named spawn point to world coordinates", testSpawnResolvesNamedPointToWorldPosition],
  ["EntitySpawner.spawn round-robins through a spawn zone", testSpawnZoneRoundRobinsThroughPoints],
  ["EntitySpawner modifiers scale HealthComponent.maximum only", testHealthMultiplierScalesMaximumOnly],
  ["EntitySpawner.spawnAuthored accepts authored entity data directly", testSpawnAuthoredAcceptsEntityDataShapeDirectly],
  ["EntitySpawner.respawn resets position/health and re-enables", testRespawnResetsPositionHealthAndReenables],
  ["PrefabFactory.createEntity warns on a duplicate uniqueId", testDuplicateUniqueIdWarnsAndCreatesASecondEntity],
];

for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}

console.log(`\n${tests.length} entity spawning tests passed.`);
