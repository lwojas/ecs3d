export function createEmptyMap() {
  const width = 8;
  const height = 8;
  return {
    width,
    height,
    defaultCeilingHeight: 2.5,
    defaultFloorHeight: 0,
    cellSize: 4,
    ambient: 0.3,
    sky: { texture: "" },
    map: Array.from({ length: height }, () => "0".repeat(width)),
    cells: {
      0: { name: "Empty", floorHeight: 0, ceilingHeight: 2.5, wall: null, floor: null, ceiling: null },
      1: { name: "Wall", floorHeight: 0, ceilingHeight: 8, wall: { texture: "", width: 4, height: 4 }, floor: null, ceiling: null },
    },
    spawnPoints: {},
    spawnZones: {},
  };
}
