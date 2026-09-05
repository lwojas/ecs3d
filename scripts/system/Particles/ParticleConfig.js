export const PARTICLE_CONFIG = {
  bloodDrop: {
    texture: "bloodDrop",

    width: 0.2,
    height: 0.2,

    scale: 4,

    lifetime: {
      min: 0.25,
      max: 0.5,
    },

    velocity: {
      x: {
        min: -2,
        max: 2,
      },

      y: {
        min: -2,
        max: 2,
      },

      z: {
        min: 2,
        max: 6,
      },
    },

    gravity: 12,
  },

  smoke: {
    texture: "smoke",

    width: 0.5,
    height: 0.5,

    scale: 4,

    lifetime: {
      min: 0.8,
      max: 1.5,
    },

    velocity: {
      x: {
        min: -0.5,
        max: 0.5,
      },

      y: {
        min: -0.5,
        max: 0.5,
      },

      z: {
        min: 0.5,
        max: 1.5,
      },
    },

    gravity: -0.5,
  },

  spark: {
    texture: "spark",

    width: 0.15,
    height: 0.15,

    scale: 4,

    lifetime: {
      min: 0.1,
      max: 0.25,
    },

    velocity: {
      x: {
        min: -4,
        max: 4,
      },

      y: {
        min: -4,
        max: 4,
      },

      z: {
        min: 1,
        max: 5,
      },
    },

    gravity: 15,
  },

  debris: {
    texture: "debris",

    width: 0.25,
    height: 0.25,

    scale: 3,

    lifetime: {
      min: 0.5,
      max: 1,
    },

    velocity: {
      x: {
        min: -3,
        max: 3,
      },

      y: {
        min: -3,
        max: 3,
      },

      z: {
        min: 2,
        max: 6,
      },
    },

    gravity: 10,
  },
};
