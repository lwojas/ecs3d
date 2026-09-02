import assert from "node:assert/strict";
import { EventBus } from "../scripts/services/EventBus.js";
import { EntityManager } from "../scripts/services/EntityManager.js";
import { PrefabFactory } from "../scripts/services/PrefabFactory.js";
import { InventorySystem } from "../scripts/system/InventorySystem.js";
import { GameplaySession } from "../scripts/api/session/GameplaySession.js";
import { MapWorld } from "../scripts/api/session/MapWorld.js";

// --- InventorySystem, against a bare InventoryComponent -----------------

new EventBus("game");
const entityManager = new EntityManager();
const prefabFactory = new PrefabFactory(entityManager, {
  npc: { InventoryComponent: { items: ["pistol"], equipped: "pistol" } },
});
const inventorySystem = new InventorySystem();

function makeInventoryEntity(uniqueId, overrides = {}) {
  return prefabFactory.createEntity({
    type: "npc",
    uniqueId,
    components: { InventoryComponent: overrides },
  });
}

function testHasReflectsOwnedItems() {
  const entity = makeInventoryEntity("inv_has", { items: ["pistol"] });
  assert.equal(inventorySystem.has(entity, "pistol"), true);
  assert.equal(inventorySystem.has(entity, "shotgun"), false);
}

function testAddIsIdempotent() {
  const entity = makeInventoryEntity("inv_add", { items: ["pistol"] });
  inventorySystem.add(entity, "shotgun");
  inventorySystem.add(entity, "shotgun");
  assert.deepEqual(inventorySystem.getInventory(entity).items, ["pistol", "shotgun"]);
}

function testRemoveClearsEquippedWhenItWasTheRemovedItem() {
  const entity = makeInventoryEntity("inv_remove", {
    items: ["pistol", "shotgun"],
    equipped: "shotgun",
  });
  const removed = inventorySystem.remove(entity, "shotgun");
  assert.equal(removed, true);
  assert.deepEqual(inventorySystem.getInventory(entity).items, ["pistol"]);
  assert.equal(inventorySystem.getEquipped(entity), null);
}

function testRemoveOfUnownedItemReturnsFalse() {
  const entity = makeInventoryEntity("inv_remove_unowned", { items: ["pistol"] });
  assert.equal(inventorySystem.remove(entity, "shotgun"), false);
}

function testEquipRefusesUnownedItem() {
  const entity = makeInventoryEntity("inv_equip_refuse", { items: ["pistol"] });
  const equipped = inventorySystem.equip(entity, "shotgun");
  assert.equal(equipped, false);
  assert.equal(inventorySystem.getEquipped(entity), null);
}

function testEquipSucceedsForOwnedItem() {
  const entity = makeInventoryEntity("inv_equip_ok", { items: ["pistol", "shotgun"] });
  inventorySystem.equip(entity, "shotgun");
  assert.equal(inventorySystem.getEquipped(entity), "shotgun");
}

function testGetSnapshotReturnsPlainCopy() {
  const entity = makeInventoryEntity("inv_snapshot", {
    items: ["pistol"],
    equipped: "pistol",
  });
  const snapshot = inventorySystem.getSnapshot(entity);
  assert.deepEqual(snapshot, { items: ["pistol"], equipped: "pistol" });

  // Must be a copy -- mutating it should not affect the component.
  snapshot.items.push("shotgun");
  assert.deepEqual(inventorySystem.getInventory(entity).items, ["pistol"]);
}

// --- MapWorld initial-inventory precedence -------------------------------

function fakeCreateRaycaster() {
  return {
    cellSize: 4,
    cellToWorld(cellX, cellY) {
      return { x: cellX * this.cellSize, y: cellY * this.cellSize };
    },
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

function buildSession(session) {
  const gameplaySession = new GameplaySession(session);
  const world = new MapWorld(gameplaySession, {
    game: {},
    createRaycaster: fakeCreateRaycaster,
  });
  world.buildWorld();
  return world;
}

function testAuthoredInventoryOverrideBeatsPersistent() {
  const session = buildSession({
    gameMode: "singleplayer",
    map: minimalMapData,
    entities: [
      {
        type: "player",
        uniqueId: "player-1",
        components: {
          SpawnComponent: { point: "playerStart" },
          InventoryComponent: { items: ["pistol", "shotgun"], equipped: "shotgun" },
        },
      },
    ],
    players: [
      { id: "player-1", state: { inventory: { items: ["pistol"], equipped: "pistol" } } },
    ],
  });

  const entity = session.playerEntities.get("player-1");
  const inventory = entity.getComponent("InventoryComponent");
  assert.deepEqual(inventory.items, ["pistol", "shotgun"]);
  assert.equal(inventory.equipped, "shotgun");
}

function testPersistentInventoryFlowsInWhenNoAuthoredOverride() {
  const session = buildSession({
    gameMode: "deathmatch",
    map: minimalMapData,
    entities: [],
    players: [
      {
        id: "player-1",
        state: { inventory: { items: ["pistol", "shotgun"], equipped: "shotgun" } },
      },
    ],
  });

  const entity = session.playerEntities.get("player-1");
  const inventory = entity.getComponent("InventoryComponent");
  assert.deepEqual(inventory.items, ["pistol", "shotgun"]);
  assert.equal(inventory.equipped, "shotgun");
}

function testComponentDefaultsAreTheFinalFallback() {
  const session = buildSession({
    gameMode: "deathmatch",
    map: minimalMapData,
    entities: [],
    players: [{ id: "player-1" }], // no state.inventory at all
  });

  const entity = session.playerEntities.get("player-1");
  const inventory = entity.getComponent("InventoryComponent");
  // componentDefaults.player.InventoryComponent, untouched.
  assert.deepEqual(inventory.items, ["pistol"]);
  assert.equal(inventory.equipped, "pistol");
}

const tests = [
  ["InventorySystem.has reflects owned items", testHasReflectsOwnedItems],
  ["InventorySystem.add is idempotent", testAddIsIdempotent],
  [
    "InventorySystem.remove clears .equipped when it was the removed item",
    testRemoveClearsEquippedWhenItWasTheRemovedItem,
  ],
  ["InventorySystem.remove of an unowned item returns false", testRemoveOfUnownedItemReturnsFalse],
  ["InventorySystem.equip refuses an unowned item", testEquipRefusesUnownedItem],
  ["InventorySystem.equip succeeds for an owned item", testEquipSucceedsForOwnedItem],
  ["InventorySystem.getSnapshot returns an independent plain copy", testGetSnapshotReturnsPlainCopy],
  [
    "MapWorld: authored InventoryComponent override beats persistent inventory",
    testAuthoredInventoryOverrideBeatsPersistent,
  ],
  [
    "MapWorld: persistent inventory flows in when no authored override exists",
    testPersistentInventoryFlowsInWhenNoAuthoredOverride,
  ],
  [
    "MapWorld: component defaults are the final fallback",
    testComponentDefaultsAreTheFinalFallback,
  ],
];

for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}

console.log(`\n${tests.length} inventory tests passed.`);
