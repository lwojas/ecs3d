// Entity data for Case A (authored single-player/co-op scenario): one
// unified collection, no splitting by category. Positions are never
// authored directly -- each entity references a named map spawn point via
// SpawnComponent, resolved to world coordinates by EntitySpawner at
// spawn time.
export const testEntities = [
  {
    // uniqueId intentionally matches sessions.js's player id ("player-1")
    // so GameplayManager.getPlayer(entity.id) resolves directly -- see
    // SinglePlayerWhiteroom's entityById lookup / SinglePlayerRules.
    type: "player",
    uniqueId: "player-1",
    components: {
      SpawnComponent: { point: "playerStart" },
    },
  },
  // {
  //   type: "enemy",
  //   uniqueId: "enemy_1",
  //   components: {
  //     SpawnComponent: { point: "enemySpawn" },
  //   },
  // },
  // {
  //   type: "enemy",
  //   uniqueId: "enemy_2",
  //   components: {
  //     SpawnComponent: { point: "courtyardB" },
  //   },
  // },
  {
    type: "pickup",
    uniqueId: "pickup1",
    components: {},
  },
  {
    type: "light",
    uniqueId: "light_1",
    components: {
      LightComponent: { enabled: true, x: 14, y: 14 },
    },
  },
  {
    type: "light",
    uniqueId: "light_2",
    components: {
      LightComponent: { enabled: false, x: 28, y: 14 },
    },
  },
  {
    type: "light",
    uniqueId: "light_3",
    components: {
      LightComponent: { enabled: false, x: 44, y: 14 },
    },
  },
  // Architectural integration test for the trigger/event-action layer:
  // walking into this volume (one cell east of playerStart) turns
  // light_1 off and light_2/light_3 on, via TriggerSystem -> EventBus ->
  // EventRouter -> LightSystem.setLights -- no code here knows what
  // "lights.set" does. onEnter is a list -- a trigger could fire e.g. a
  // "door.set" action here too, once something registers for it.
  {
    type: "trigger",
    uniqueId: "trigger_lights_demo",
    components: {
      SpawnComponent: { point: "lightsTrigger" },
      TriggerComponent: {
        once: true,
        onEnter: [
          {
            event: "lights.set",
            data: { on: ["light_2", "light_3"], off: ["light_1"] },
          },
        ],
      },
    },
  },
];
