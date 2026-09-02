import assert from "node:assert/strict";
import { GameplaySession } from "../scripts/api/session/GameplaySession.js";
import { MapWorld } from "../scripts/api/session/MapWorld.js";

// Demonstrates the lifecycle boundary this refactor exists to establish:
// GameplaySession (Gameplay/Rules/Users) is created once and survives a
// MapWorld being destroyed and a new one built in its place -- the way
// a real map transition would work, minus an actual Phaser state swap
// (see GameplaySession.js/MapWorld.js for the ownership split, and
// level-singleplayer-whiteroom.js for how a Phaser state hosts this).

function fakeCreateRaycaster() {
  return {
    cellSize: 4,
    cellToWorld(cellX, cellY) {
      return { x: cellX * this.cellSize, y: cellY * this.cellSize };
    },
    destroy() {},
  };
}

const minimalMapData = {
  spawnPoints: {
    playerStart: { cellX: 3.5, cellY: 3.5, angle: 0 },
  },
  spawnZones: {
    players: ["playerStart"],
  },
};

function makeSessionConfig() {
  return {
    gameMode: "singleplayer",
    map: minimalMapData,
    entities: [],
    players: [
      {
        id: "player-1",
        name: "Player",
        state: {
          health: 100,
          inventory: { items: ["pistol"], equipped: "pistol" },
          resources: { plasma: 50 },
        },
      },
    ],
  };
}

function buildWorld(gameplaySession) {
  const world = new MapWorld(gameplaySession, {
    game: {},
    createRaycaster: fakeCreateRaycaster,
  });
  world.buildWorld();
  return world;
}

function testPersistentGameplayAndUserSurviveAMapTransition() {
  // 1. Create one persistent gameplay session with a User.
  const gameplaySession = new GameplaySession(makeSessionConfig());
  const persistentUser = gameplaySession.gameplay.getPlayer("player-1");
  assert.ok(persistentUser, "GameplaySession should own a persistent User for player-1");

  // 2. Load/build Map A.
  const mapA = buildWorld(gameplaySession);
  const entityA = mapA.playerEntities.get("player-1");
  assert.ok(entityA, "Map A should hydrate an ECS entity for player-1");
  assert.equal(entityA.getComponent("InventoryComponent").equipped, "pistol");
  assert.equal(
    persistentUser.entityId,
    entityA.id,
    "the persistent User should be bound to Map A's entity",
  );

  // 3. Mutate some runtime player state (pick up and equip a new item).
  mapA.inventorySystem.add(entityA, "shotgun");
  mapA.inventorySystem.equip(entityA, "shotgun");

  // 4 & 5. Snapshot happens inside destroy() -- unload Map A.
  mapA.destroy();

  assert.deepEqual(
    persistentUser.state.inventory,
    { items: ["pistol", "shotgun"], equipped: "shotgun" },
    "the pickup should be snapshotted back onto the persistent User",
  );
  assert.equal(
    persistentUser.hasEntity(),
    false,
    "the persistent User should be unbound once its world is destroyed",
  );

  // Gameplay/Rules/Users were never rebuilt for Map A -- confirm MapWorld
  // is just hosting the one GameplaySession already built.
  assert.equal(mapA.gameplayManager, gameplaySession.gameplay);

  // 6. Load Map B off the SAME persistent GameplaySession. A real
  // transition would also point gameplaySession.config.map/entities at
  // the next map first; same map data is reused here since only the
  // Gameplay/User lifecycle is under test, not map data resolution.
  const mapB = buildWorld(gameplaySession);
  const entityB = mapB.playerEntities.get("player-1");
  assert.ok(entityB, "Map B should hydrate a *new* ECS entity for player-1");
  assert.notEqual(entityB, entityA, "Map B must spawn a fresh entity, not reuse Map A's");

  // 7. The persistent User -- not Map A's destroyed world -- is what
  // hydrates Map B's entity, so the pickup carries across the
  // transition.
  const inventoryB = entityB.getComponent("InventoryComponent");
  assert.deepEqual(inventoryB.items, ["pistol", "shotgun"]);
  assert.equal(inventoryB.equipped, "shotgun");
  assert.equal(
    persistentUser.entityId,
    entityB.id,
    "the persistent User should be rebound to Map B's entity",
  );

  // Same Gameplay instance, same User instance, across both maps.
  assert.equal(mapB.gameplayManager, gameplaySession.gameplay);
  assert.equal(mapB.gameplayManager.getPlayer("player-1"), persistentUser);
}

const tests = [
  [
    "persistent Gameplay/User state survives a MapWorld destroy+rebuild cycle",
    testPersistentGameplayAndUserSurviveAMapTransition,
  ],
];

for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}

console.log(`\n${tests.length} session lifecycle tests passed.`);
