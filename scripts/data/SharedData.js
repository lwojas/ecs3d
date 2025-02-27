export const componentDefaults = {
  player_ship: {
    Position: { x: 100, y: 100 },
    InputComponent: "",
    InventoryComponent: {},
    SpriteComponent: { spriteKey: "defaultSprite" },
    PhysicsDynamicComponent: { mass: 1, friction: 0.5 },
    // ShipPhysicsComponent: { drag: 20, maxAngular: 100, maxVelocity: 200 },
    MotionShipComponent: "",
    PlayerComponent: "",
    MovementComponent: { maxSpeed: 100 },
    ShipExhaustComponent: { spriteKey: "pixelWhite" },
    WeaponControllerComponent: {},
  },
  trigger: {
    Position: { x: 100, y: 100 },
    SpriteComponent: { spriteKey: "defaultObject" },
    TriggerComponent: {
      runOnce: false,
      action: "TEST_ACTION",
      args: "Test action firing",
    },
    // OverlapComponent: "",
    // PhysicsStaticComponent: "",
  },
  weapon: {
    WeaponComponent: { weaponSprite: "shipTurretDefault" },
  },
};
