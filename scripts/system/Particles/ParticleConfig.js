export const PARTICLE_CONFIG = {
  bloodDrop: {
    texture: "bloodDrop",
    width: 0.18,
    height: 0.18,
    scale: 1,

    lifetime: {
      min: 0.12,
      max: 0.3,
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
        min: 3,
        max: 5,
      },
    },

    gravity: 16,
  },

  deathGib: {
    texture: ["gib", "bloodDrop"],
    width: 0.28,
    height: 0.28,
    scale: {
      min: 2,
      max: 5,
    },

    lifetime: {
      min: 0.3,
      max: 0.8,
    },

    velocity: {
      x: {
        min: -8,
        max: 8,
      },
      y: {
        min: -8,
        max: 8,
      },
      z: {
        min: 2,
        max: 15,
      },
    },

    gravity: 30,
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

  portal: {
    texture: "portalParticle",
    width: 0.3,
    height: 0.3,
    scale: 2,

    lifetime: {
      min: 0.5,
      max: 0.7,
    },

    velocity: {
      x: {
        min: -10,
        max: 10,
      },
      y: {
        min: -10,
        max: 10,
      },
      z: {
        min: 5,
        max: 8,
      },
    },

    gravity: -1,
  },
};
