// Map data: geometry only -- no entities. Same cell layout as
// 3dtestLevel.js, plus named spawn points/zones so entity data can
// reference a location without knowing any world/cell-size math.
//
// spawnPoints are authored in *cell space* (fractional cell coordinates,
// e.g. 3.5 = the middle of cell 3) -- EntitySpawner resolves them to world
// coordinates via raycaster.cellToWorld(), so a cellSize change never
// requires touching this data.
export const testMap = {
  width: 16,
  height: 16,
  defaultCeilingHeight: 2.5,
  defaultFloorHeight: 0,
  cellSize: 4,
  ambient: 0.24,

  sky: {
    texture: "skyTexture",
  },

  map: [
    "1111111111111111",
    "1000000000000001",
    "1000000000000001",
    "1000000000000001",
    "1000011111000001",
    "1000000001000001",
    "1000040001000001",
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
      floor: { texture: "floorTexture", width: 4, height: 4 },
      ceiling: null,
      fog: { distance: 24, color: { r: 29, g: 6, b: 6 } },
    },

    1: {
      floorHeight: 0,
      ceilingHeight: 8,
      wall: { texture: "wallTexture", width: 4, height: 4 },
      floor: { texture: "floorTexture", width: 4, height: 4 },
      ceiling: { texture: "ceilingTexture", width: 4, height: 4 },
      fog: { distance: 24, color: { r: 29, g: 6, b: 6 } },
    },

    2: {
      floorHeight: 0,
      ceilingHeight: 16,
      wall: { texture: "brickTexture", width: 2, height: 1.5 },
      floor: { texture: "floorTexture", width: 4, height: 4 },
      ceiling: { texture: "ceilingTexture", width: 4, height: 4 },
      fog: { distance: 24, color: { r: 90, g: 90, b: 100 } },
    },

    3: {
      floorHeight: 0,
      ceilingHeight: 0.5,
      wall: { texture: "brickTexture", width: 2, height: 1.5 },
      blocking: false,
      floor: { texture: "floorTexture", width: 4, height: 4 },
      ceiling: { texture: "floorTexture", width: 4, height: 4 },
    },

    4: {
      floorHeight: 0,
      ceilingHeight: 12,
      sections: [
        {
          bottom: 0,
          top: 1,
          material: { texture: "wallTexture", width: 4, height: 4 },
        },
        {
          bottom: 6,
          top: 12,
          material: { texture: "wallTexture", width: 4, height: 4 },
        },
      ],
      floor: { texture: "floorTexture", width: 4, height: 4 },
      ceiling: { texture: "ceilingTexture", width: 4, height: 4 },
    },
  },

  // Named points, in cell space. Case A/B/C entity data and rules
  // reference these by name only.
  spawnPoints: {
    playerStart: { cellX: 3.5, cellY: 3.5, angle: 0 },
    playerStart2: { cellX: 10.5, cellY: 2.5, angle: 0 },
    enemySpawn: { cellX: 7, cellY: 3.5, angle: 0 },
    courtyardA: { cellX: 5, cellY: 3.5, angle: 0 },
    courtyardB: { cellX: 11, cellY: 3.5, angle: 0 },
    lightsTrigger: { cellX: 4.5, cellY: 3.5, angle: 0 },
  },

  // Named groups of point names -- waves/bots can request a zone instead
  // of a single point; EntitySpawner round-robins through its points.
  spawnZones: {
    courtyard: ["courtyardA", "courtyardB"],
    players: ["playerStart", "playerStart2"],
  },
};
