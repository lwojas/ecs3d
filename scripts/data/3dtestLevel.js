export const testLevel = {
  width: 16,
  height: 16,
  defaultCeilingHeight: 2.5,
  defaultFloorHeight: 0,

  map: [
    "1111111111111111",
    "1000000000000001",
    "1000000000000001",
    "1000000000000001",
    "1000011111000001",
    "1000000001000001",
    "1000010001000001",
    "1000010001000001",
    "1000010301000001",
    "1000010001000001",
    "1000010222000001",
    "1000000000000001",
    "1000000000000001",
    "1000000000000001",
    "1000000000000001",
    "1111111111111111",
  ],

  cells: {
    0: {
      floorHeight: 0,
      ceilingHeight: 2.5,

      wall: null,

      floor: {
        texture: "floorTexture",
        width: 4,
        height: 4,
      },

      ceiling: null,
      fog: {
        distance: 24,
        color: { r: 90, g: 90, b: 100 },
      },
    },

    1: {
      floorHeight: 0,
      ceilingHeight: 8,

      wall: {
        texture: "wallTexture",
        width: 4,
        height: 4,
      },

      floor: {
        texture: "floorTexture",
        width: 4,
        height: 4,
      },

      ceiling: {
        texture: "ceilingTexture",
        width: 4,
        height: 4,
      },
    },

    2: {
      floorHeight: 0,
      ceilingHeight: 16,

      wall: {
        texture: "brickTexture",
        width: 2,
        height: 1.5,
      },

      floor: {
        texture: "floorTexture",
        width: 4,
        height: 4,
      },

      ceiling: {
        texture: "ceilingTexture",
        width: 4,
        height: 4,
      },

      // A fog "zone": every cell of this type is fogged, the rest of the
      // level (cell 0, the open corridor) is not.
      fog: {
        distance: 24,
        color: { r: 90, g: 90, b: 100 },
      },
    },
    3: {
      floorHeight: 0,
      ceilingHeight: 0.5,

      wall: {
        texture: "brickTexture",
        width: 2,
        height: 1.5,
      },

      // Low enough to step onto rather than block movement; standing here
      // rests on the block's top (ceilingHeight = 0.5), not its base.
      blocking: false,

      floor: {
        texture: "floorTexture",
        width: 4,
        height: 4,
      },

      ceiling: {
        texture: "floorTexture",
        width: 4,
        height: 4,
      },
    },
  },
};
