export const componentDefaults = {
  player_ship: {
    Position: { x: 100, y: 100 },
    InputComponent: "",
    AmmoComponent: {
      ammoTypes: [
        { type: "canon", amount: 10, props: { power: 100, speed: 300 } },
      ],
    },
    InventoryComponent: {},
    SpriteComponent: { spriteKey: "defaultSprite" },
    PhysicsDynamicComponent: { mass: 1, friction: 0.5 },
    MotionShipComponent: "",
    PlayerComponent: "",
    CameraFollowComponent: {},
    MovementComponent: { maxSpeed: 100 },
    ShipExhaustComponent: { spriteKey: "pixelWhite" },
    WeaponControllerComponent: {},
  },

  trigger: {
    Position: { x: 100, y: 100 },
    SpriteComponent: { spriteKey: "defaultObject" },
    TriggerComponent: {
      runOnce: false,
      action: "G_INVENTORY_ADD_ITEM",
      // args: "Test action firing",
    },
    PhysicsStaticComponent: "",
  },

  weapon: {
    WeaponComponent: {
      spriteKey: "shipTurretDefault",
      weaponType: "canon",
      weaponClass: "gun",
    },
  },

  projectile: {
    ProjectileComponent: {
      spriteKey: "pixelWhite",
      weaponType: "canon", // "canon || missile || energy"
      // weaponType: "",
      // power: 90,
      // lifeTime: 4,
    },
  },
};
