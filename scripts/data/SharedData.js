export const componentDefaults = {
  player_ship: {
    Position: { x: 100, y: 100 },
    InputComponent: "",
    AmmoComponent: {
      ammoTypes: [
        { type: "canon", amount: 1000, props: { power: 100, speed: 300 } },
      ],
    },
    InventoryComponent: {},
    SpriteComponent: { spriteKey: "defaultSprite" },
    PhysicsDynamicComponent: { mass: 1, friction: 0.5 },
    MotionShipComponent: "",
    // PendulumStateComponent: {},
    PlayerComponent: "",
    CameraFollowComponent: {},
    MovementComponent: { maxSpeed: 200 },
    ShipExhaustComponent: { spriteKey: "pixelWhite" },
    WeaponControllerComponent: {},
    HealthComponent: { health: 50 },
    FactionComponent: {
      faction: {
        pirate: 50,
        player: -100,
        police: 0,
        trader: 0,
        civilian: 0,
      },
    },
    CollideComponent: {},
    TriggerSendComponent: {},
  },

  pirate: {
    SpriteComponent: { spriteKey: "Cobra" },
    PhysicsDynamicComponent: {},
    TargetComponent: {},
    ShipExhaustComponent: { spriteKey: "pixelWhite" },
    PerceptionComponent: {},
    FactionComponent: {
      allegiance: "pirate",
      faction: {
        pirate: -99,
        player: 70,
        police: 30,
        trader: -20,
        civilian: 50,
      },
    },
    AmmoComponent: {
      ammoTypes: [
        { type: "canon", amount: 1000, props: { power: 100, speed: 300 } },
      ],
    },
    InventoryComponent: {},
    WeaponControllerComponent: {},
    EmotionComponent: { aggression: 50 },
    HealthComponent: { health: 100 },
    IntelligenceComponent: { intelligence: 1, obedience: 0.5 },
    AIStateComponent: {},
    NPCMotionComponent: {},
    CollideComponent: {},
    PatrolComponent: {
      currentIndex: 0,
      currentPatrolAction: "default",
    },
    GoalComponent: {},
    MovementComponent: { maxSpeed: 75 },
  },

  trader: {
    SpriteComponent: { spriteKey: "Cobra" },
    PhysicsDynamicComponent: {},
    ShipExhaustComponent: { spriteKey: "pixelWhite" },
    TargetComponent: {},
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
    AIStateComponent: {},
    NPCMotionComponent: {},
    CollideComponent: {},
    MovementComponent: { maxSpeed: 90 },
    // InputComponent: "",
  },

  trigger: {
    Position: { x: 100, y: 100 },
    SpriteComponent: { spriteKey: "defaultObject" },
    TriggerComponent: {
      runOnce: false,
      action: "G_INVENTORY_ADD_ITEM",
      args: "Test action firing",
    },
    PhysicsDynamicComponent: "",
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
      damage: 20,
      // weaponType: "",
      // power: 90,
      // lifeTime: 4,
    },
    DamageComponent: { amount: 20 },
  },
};
