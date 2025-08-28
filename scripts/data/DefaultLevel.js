export const defaultLevel = {
  entities: [
    // {
    //   type: "background",
    //   components: {
    //     Position: { x: 0, y: 0 },
    //     SpriteComponent: { spriteKey: "starfield", layer: "bg0", scale: 4 },
    //   },
    // },
    {
      type: "background",
      components: {
        Position: { x: 400, y: 500 },
        SpriteComponent: {
          spriteKey: "defaultObject",
          layer: "shadows",
          scale: 4,
        },
        ShadowComponent: { sprite: "defaultObject", scale: 4 },
      },
    },
    // {
    //   type: "background",
    //   components: {
    //     Position: { x: 300, y: 500 },
    //     SpriteComponent: {
    //       spriteKey: "defaultObject",
    //       layer: "shadows",
    //       scale: 4,
    //     },
    //     // ShadowComponent: { sprite: "defaultObject", scale: 4 },
    //     LightComponent: ["defaultLight"],
    //   },
    // },
    {
      type: "player_ship",
      uniqueId: "player_1",
      components: {
        Position: { x: 100, y: 100 },
        SpriteComponent: { spriteKey: "Cobra", layer: "fg3" },
        CameraFollowComponent: {},
        PerceptionComponent: "",
        LightComponent: ["defaultLight"],
      },
    },
    {
      type: "pirate",
      uniqueId: "pirate_test",
      components: {
        Position: { x: 300, y: 300 },
      },
    },

    {
      type: "trader",
      uniqueId: "trader_test",
      components: {
        Position: { x: 400, y: 400 },
      },
    },

    {
      type: "pirate",
      uniqueId: "pirate_2",
      components: {
        Position: { x: 500, y: 400 },
        FactionComponent: {
          allegiance: "pirate",
          faction: {
            pirate: -21,
            player: 30,
            police: 30,
            trader: 70,
            civilian: 50,
          },
        },
      },
    },

    {
      type: "trigger",
      uniqueId: "test_trigger",
      components: {
        Position: { x: 200, y: 100 },
        // InputComponent: {},
        // MotionShipComponent: "",
        // ShipExhaustComponent: "",
        // MovementComponent: "",
        // No SpriteComponent, so it should default to "defaultSprite"
        CheckConditionComponent: {
          conditions: [
            { type: "keyPress", key: "space" },
            // { type: "inventoryCheck", item: "key" },
          ],
        },
        TriggerComponent: {
          // runOnce: true,
          action: "G_CHANGE_SPRITE",
          args: { spriteKey: "defaultObject" },
        },
      },
    },

    {
      type: "trigger",
      uniqueId: "test_turret",
      components: {
        Position: { x: 300, y: 100 },
        SpriteComponent: { spriteKey: "shipTurretDefault" },
        WeaponComponent: {
          spriteKey: "shipTurretDefault",
          weaponType: "canon",
          weaponClass: "gun",
        },
      },
    },
    {
      type: "trigger",
      uniqueId: "ammo_trigger",
      components: {
        Position: { x: 600, y: 100 },
        TriggerComponent: {
          runOnce: true,
          action: "G_ADD_AMMO",
        },
        AmmoItemComponent: { weaponType: "canon", amount: 200 },
      },
    },
    {
      type: "projectile",
    },
  ],
};
