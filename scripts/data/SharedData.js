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
    MovementComponent: { maxSpeed: 200 },
    ShipExhaustComponent: { spriteKey: "pixelWhite" },
    WeaponControllerComponent: {},
    HealthComponent: { health: 300 },
    FactionComponent: {
      faction: {
        pirate: 0,
        player: -100,
        police: 0,
        trader: 0,
        civilian: 0,
      },
    },
  },

  pirate: {
    SpriteComponent: { spriteKey: "Cobra" },
    PerceptionComponent: {},
    FactionComponent: {
      allegiance: "pirate",
      faction: {
        pirate: -99,
        player: 30,
        police: 30,
        trader: 70,
        civilian: 50,
      },
    },
    EmotionComponent: { aggression: 50 },
    HealthComponent: { health: 100 },
    IntelligenceComponent: { intelligence: 1, obedience: 0.5 },
  },

  trader: {
    SpriteComponent: { spriteKey: "Cobra" },
    PerceptionComponent: {},
    FactionComponent: {
      // allegiance: "pirate",
      faction: {
        pirate: 30,
        player: -10,
        police: -30,
        trader: -99,
        civilian: -10,
      },
    },
    EmotionComponent: { aggression: -50 },
    HealthComponent: { health: 50 },
    IntelligenceComponent: { intelligence: 1, obedience: 0 },
  },

  trigger: {
    Position: { x: 100, y: 100 },
    SpriteComponent: { spriteKey: "defaultObject" },
    TriggerComponent: {
      runOnce: false,
      action: "G_INVENTORY_ADD_ITEM",
      args: "Test action firing",
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
