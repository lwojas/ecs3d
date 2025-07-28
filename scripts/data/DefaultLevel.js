export const defaultLevel = {
  entities: [
    {
      type: "player_ship",
      uniqueId: "player_1",
      components: {
        Position: { x: 100, y: 100 },
        SpriteComponent: { spriteKey: "Cobra" },
        CameraFollowComponent: {},
      },
    },
    {
      type: "background",
      components: {
        Position: { x: 300, y: 300 },
        SpriteComponent: { spriteKey: "Cobra" },
      },
    },
    {
      type: "trigger",
      uniqueId: "test_trigger",
      components: {
        Position: { x: 200, y: 100 },
        InputComponent: {},
        // No SpriteComponent, so it should default to "defaultSprite"
        CheckConditionComponent: {
          conditions: [
            { type: "keyPress", key: "space" },
            // { type: "inventoryCheck", item: "key" },
          ],
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
