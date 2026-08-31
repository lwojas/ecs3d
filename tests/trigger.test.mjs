import assert from "node:assert/strict";
import { EventBus } from "../scripts/services/EventBus.js";
import { EventRouter } from "../scripts/services/EventRouter.js";
import { EntityManager } from "../scripts/services/EntityManager.js";
import { PrefabFactory } from "../scripts/services/PrefabFactory.js";
import { CollisionSystem } from "../scripts/system/CollisionSystem.js";
import { TriggerSystem } from "../scripts/system/TriggerSystem.js";
import { LightSystem } from "../scripts/system/LightSystem.js";

// Each test builds its own fully isolated world (fresh EventBus/
// EntityManager/PrefabFactory/systems) -- same pattern game-session.test.mjs
// and inventory.test.mjs already use, so aggregate/per-frame systems like
// CollisionSystem/TriggerSystem never see leftover entities from an
// earlier test.
//
// Every system here builds its parallel component list once, at
// construction time (same as MovementSystem/LightSystem/etc.) -- it's
// never refreshed as entities are added afterward. In production this
// is a non-issue because GameSession spawns every entity in
// buildWorld() before constructing any system in attachView(). These
// helpers deliberately mirror that order: create all entities first,
// construct systems after.
function makeWorld() {
  new EventBus("game"); // registers "game"/"EventSystem" -- TriggerSystem resolves it
  const entityManager = new EntityManager();
  const prefabFactory = new PrefabFactory(entityManager, {
    activator: { MovementComponent: {}, CollisionComponent: {} },
    trigger: {},
    light: {},
  });
  return { entityManager, prefabFactory };
}

function makeCollisionAndTriggerSystems() {
  const fakeRenderer = { debugObjects: [] };
  const collisionSystem = new CollisionSystem(fakeRenderer);
  collisionSystem.debug = false;
  const triggerSystem = new TriggerSystem(collisionSystem.collisionEvents);
  return { collisionSystem, triggerSystem };
}

function makeTrigger(prefabFactory, uniqueId, triggerConfig) {
  return prefabFactory.createEntity({
    type: "trigger",
    uniqueId,
    components: {
      MovementComponent: {},
      CollisionComponent: {},
      TriggerComponent: triggerConfig,
    },
  });
}

function makeActivator(prefabFactory, uniqueId) {
  return prefabFactory.createEntity({
    type: "activator",
    uniqueId,
    components: {},
  });
}

function moveAway(entity) {
  entity.getComponent("MovementComponent").x = 99999;
}

// --- EventBus -------------------------------------------------------

function testEmitReturnsFalseAndStaysSilentWithoutDebug() {
  const bus = new EventBus("game");
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => (warned = true);

  const result = bus.emit("nothing.listening", { a: 1 });

  console.warn = originalWarn;
  assert.equal(result, false);
  assert.equal(warned, false);
}

function testEmitReturnsTrueAndCallsListenersWithPayloadAndContext() {
  const bus = new EventBus("game");
  const received = [];
  bus.on("test.event", (data, context) => received.push({ data, context }));

  const result = bus.emit("test.event", { foo: "bar" }, { activator: "x" });

  assert.equal(result, true);
  assert.deepEqual(received, [{ data: { foo: "bar" }, context: { activator: "x" } }]);
}

// --- EventRouter ------------------------------------------------------

function testEventRouterIsSafeNoOpWithoutLightingSystemRegistered() {
  const bus = new EventBus("game");
  new EventRouter(bus);

  assert.doesNotThrow(() => bus.emit("lights.set", { on: ["light_1"] }));
}

function testEventRouterRoutesLightsSetToRegisteredLightingSystem() {
  const bus = new EventBus("game");
  const router = new EventRouter(bus);

  const calls = [];
  router.registerLightingSystem({ setLights: (data) => calls.push(data) });

  bus.emit("lights.set", { on: ["light_2"], off: ["light_1"] });

  assert.deepEqual(calls, [{ on: ["light_2"], off: ["light_1"] }]);
}

// --- LightSystem.setLights --------------------------------------------

function testLightSystemSetLightsTogglesByUniqueId() {
  const { prefabFactory } = makeWorld();

  const light1 = prefabFactory.createEntity({
    type: "light",
    uniqueId: "light_1",
    components: { LightComponent: { enabled: true } },
  });
  const light2 = prefabFactory.createEntity({
    type: "light",
    uniqueId: "light_2",
    components: { LightComponent: { enabled: false } },
  });

  const lightSystem = new LightSystem({ lights: [] });
  lightSystem.setLights({ on: ["light_2"], off: ["light_1"] });

  assert.equal(light1.getComponent("LightComponent").enabled, false);
  assert.equal(light2.getComponent("LightComponent").enabled, true);
}

// --- TriggerSystem ------------------------------------------------------

function testEnterFiresOnceNotEveryFrameWhileInside() {
  const { prefabFactory } = makeWorld();

  makeTrigger(prefabFactory, "trigger_1", {
    once: false,
    onEnter: [{ event: "test.enter", data: { marker: 1 } }],
  });
  makeActivator(prefabFactory, "activator_1");

  const { collisionSystem, triggerSystem } = makeCollisionAndTriggerSystems();
  const fired = [];
  triggerSystem.eventBus.on("test.enter", (data) => fired.push(data));

  for (let i = 0; i < 3; i++) {
    collisionSystem.update();
    triggerSystem.update();
  }

  assert.equal(fired.length, 1);
}

function testLeavingAndReenteringRefiresWhenNotOnce() {
  const { prefabFactory } = makeWorld();

  makeTrigger(prefabFactory, "trigger_1", {
    once: false,
    onEnter: [{ event: "test.enter", data: {} }],
  });
  const activator = makeActivator(prefabFactory, "activator_1");

  const { collisionSystem, triggerSystem } = makeCollisionAndTriggerSystems();
  const fired = [];
  triggerSystem.eventBus.on("test.enter", () => fired.push(1));

  collisionSystem.update();
  triggerSystem.update();
  assert.equal(fired.length, 1);

  moveAway(activator);
  collisionSystem.update();
  triggerSystem.update();
  assert.equal(fired.length, 1, "no refire while merely leaving");

  activator.getComponent("MovementComponent").x = 14; // back to the trigger's position
  collisionSystem.update();
  triggerSystem.update();
  assert.equal(fired.length, 2, "re-entering should refire when once is false");
}

function testOnceTrueBlocksASecondActivatorToo() {
  const { prefabFactory } = makeWorld();

  makeTrigger(prefabFactory, "trigger_1", {
    once: true,
    onEnter: [{ event: "test.enter", data: {} }],
  });
  makeActivator(prefabFactory, "activator_1");
  const second = makeActivator(prefabFactory, "activator_2");
  moveAway(second); // don't overlap on the first update()

  const { collisionSystem, triggerSystem } = makeCollisionAndTriggerSystems();
  const fired = [];
  triggerSystem.eventBus.on("test.enter", () => fired.push(1));

  collisionSystem.update();
  triggerSystem.update();
  assert.equal(fired.length, 1);

  second.getComponent("MovementComponent").x = 14; // now also overlaps
  collisionSystem.update();
  triggerSystem.update();
  assert.equal(fired.length, 1, "once:true must not refire for a second activator");
}

function testOnEnterFiresEveryConfiguredAction() {
  const { prefabFactory } = makeWorld();

  makeTrigger(prefabFactory, "trigger_1", {
    once: false,
    onEnter: [
      { event: "test.enter.a", data: { n: 1 } },
      { event: "test.enter.b", data: { n: 2 } },
    ],
  });
  makeActivator(prefabFactory, "activator_1");

  const { collisionSystem, triggerSystem } = makeCollisionAndTriggerSystems();
  const firedA = [];
  const firedB = [];
  triggerSystem.eventBus.on("test.enter.a", (data) => firedA.push(data));
  triggerSystem.eventBus.on("test.enter.b", (data) => firedB.push(data));

  collisionSystem.update();
  triggerSystem.update();

  assert.deepEqual(firedA, [{ n: 1 }]);
  assert.deepEqual(firedB, [{ n: 2 }]);
}

// --- End-to-end: CollisionSystem -> TriggerSystem -> EventBus -> EventRouter -> LightSystem

function testEndToEndTriggerTogglesLightsThroughTheWholeStack() {
  const { prefabFactory } = makeWorld();

  makeTrigger(prefabFactory, "trigger_lights_demo", {
    once: true,
    onEnter: [
      {
        event: "lights.set",
        data: { on: ["light_2", "light_3"], off: ["light_1"] },
      },
    ],
  });
  makeActivator(prefabFactory, "player-1");

  const light1 = prefabFactory.createEntity({
    type: "light",
    uniqueId: "light_1",
    components: { LightComponent: { enabled: true } },
  });
  const light2 = prefabFactory.createEntity({
    type: "light",
    uniqueId: "light_2",
    components: { LightComponent: { enabled: false } },
  });
  const light3 = prefabFactory.createEntity({
    type: "light",
    uniqueId: "light_3",
    components: { LightComponent: { enabled: false } },
  });

  const { collisionSystem, triggerSystem } = makeCollisionAndTriggerSystems();
  const lightSystem = new LightSystem({ lights: [] });
  const eventRouter = new EventRouter(triggerSystem.eventBus);
  eventRouter.registerLightingSystem(lightSystem);

  collisionSystem.update();
  triggerSystem.update();

  assert.equal(light1.getComponent("LightComponent").enabled, false);
  assert.equal(light2.getComponent("LightComponent").enabled, true);
  assert.equal(light3.getComponent("LightComponent").enabled, true);
}

const tests = [
  ["EventBus.emit returns false and stays silent without debug", testEmitReturnsFalseAndStaysSilentWithoutDebug],
  ["EventBus.emit returns true and calls listeners with payload+context", testEmitReturnsTrueAndCallsListenersWithPayloadAndContext],
  ["EventRouter is a safe no-op without a lighting system registered", testEventRouterIsSafeNoOpWithoutLightingSystemRegistered],
  ["EventRouter routes lights.set to the registered lighting system", testEventRouterRoutesLightsSetToRegisteredLightingSystem],
  ["LightSystem.setLights toggles lights by uniqueId", testLightSystemSetLightsTogglesByUniqueId],
  ["TriggerSystem: entering fires onEnter once, not every frame while inside", testEnterFiresOnceNotEveryFrameWhileInside],
  ["TriggerSystem: leaving and re-entering refires when once is false", testLeavingAndReenteringRefiresWhenNotOnce],
  ["TriggerSystem: once:true blocks a second activator too", testOnceTrueBlocksASecondActivatorToo],
  ["TriggerSystem: onEnter fires every configured action", testOnEnterFiresEveryConfiguredAction],
  ["End-to-end: trigger toggles lights through the whole stack", testEndToEndTriggerTogglesLightsThroughTheWholeStack],
];

for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}

console.log(`\n${tests.length} trigger tests passed.`);
