export const pendulumLevel = {
  entities: [
    {
      type: "background",
      uniqueId: "fixed_background",
      components: {
        Position: { x: 0, y: 0 },
        SpriteComponent: {
          spriteKey: "mountains",
          layer: "bg0",
          scale: 1,
          fixed: true,
        },
      },
    },
    // {
    //   type: "background",
    //   components: {
    //     Position: { x: 0, y: 0 },
    //     SpriteComponent: { spriteKey: "dyson", layer: "bg1", scale: 1 },
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
    {
      type: "background",
      components: {
        Position: { x: 300, y: 500 },
        SpriteComponent: {
          spriteKey: "defaultObject",
          layer: "fg3",
          scale: 4,
        },
        // ShadowComponent: { sprite: "defaultObject", scale: 4 },
        LightComponent: {
          sprites: [
            { scale: 4, sprite: "defaultLight" },
            // { scale: 1, sprite: "lightShip" },
          ],
          castShadows: true,
        },
      },
    },

    // {
    //   type: "background",
    //   components: {
    //     Position: { x: 700, y: 500 },
    //     SpriteComponent: {
    //       spriteKey: "testRoom",
    //       layer: "fg3",
    //       scale: 1,
    //     },
    //     ShadowComponent: { sprite: "testRoom", scale: 1, complex: true },
    //     // CollideComponent: {},
    //     PhysicsStaticComponent: {},
    //     // LightComponent: {
    //     //   sprites: [
    //     //     { scale: 4, sprite: "defaultLight" },
    //     //     // { scale: 1, sprite: "lightShip" },
    //     //   ],
    //     //   castShadows: true,
    //     // },
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
        PendulumStateComponent: {},
        LightComponent: {
          sprites: [
            // { scale: 4, sprite: "defaultLight" },
            { scale: 1, sprite: "lightShip" },
          ],
          castShadows: true,
          isSpot: true,
        },
      },
    },

    {
      type: "pirate",
      uniqueId: "pirate_test",
      components: {
        Position: { x: 300, y: 300 },
        LightComponent: {
          sprites: [
            // { scale: 4, sprite: "defaultLight" },
            { scale: 1, sprite: "lightShip" },
          ],
          castShadows: true,
          isSpot: true,
        },
        TriggerSendComponent: {},
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
  ],
};
