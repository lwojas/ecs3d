export const hudItems = {
  pistol: {
    type: "weapon",
    key: "hudShotgun",
    frame: 0,

    position: {
      x: 1100,
      y: 1150,
    },

    anchor: {
      x: 0.5,
      y: 1,
    },

    scale: {
      x: 4,
      y: 4,
    },

    bob: {
      enabled: true,
      amount: 30,
      speed: 200,
    },

    sway: {
      enabled: true,
      amount: 12,
      sensitivity: 0.4,
      returnSpeed: 8,
    },

    defaultState: "idle",

    states: {
      idle: {
        frames: [0],
        speed: 1,
        loop: false,
      },

      fire: {
        frames: [0, 2, 0, 1, 0],
        speed: 12,
        loop: false,
      },

      reload: {
        frames: [0, 3, 0],
        speed: 12,
        loop: false,
      },
    },
  },

  shotgun: {
    type: "weapon",
    key: "hudDecoupler",
    frame: 0,

    position: {
      x: 1100,
      y: 1150,
    },

    anchor: {
      x: 0.5,
      y: 1,
    },

    scale: {
      x: 4,
      y: 4,
    },

    bob: {
      enabled: true,
      amount: 30,
      speed: 100,
    },

    sway: {
      enabled: true,
      amount: 64,
      sensitivity: 0.4,
      returnSpeed: 8,
    },

    defaultState: "idle",

    states: {
      idle: {
        frames: [0],
        speed: 1,
        loop: false,
      },

      fire: {
        frames: [0, 1, 0],
        speed: 15,
        loop: false,
      },

      reload: {
        frames: [0, 3],
        speed: 10,
        loop: false,
      },
    },
  },
};
