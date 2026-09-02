// Spawn zones reference spawn points by name only (never copy their
// data) -- these two helpers keep that reference consistent whenever a
// point is renamed or removed, so a zone never ends up pointing at a
// name that no longer exists.

export function renameSpawnPoint(mapData, oldName, newName) {
  if (!newName || newName === oldName || mapData.spawnPoints[newName]) return mapData;

  const spawnPoints = { ...mapData.spawnPoints };
  spawnPoints[newName] = spawnPoints[oldName];
  delete spawnPoints[oldName];

  const spawnZones = {};
  for (const [zoneName, points] of Object.entries(mapData.spawnZones ?? {})) {
    spawnZones[zoneName] = points.map((p) => (p === oldName ? newName : p));
  }

  return { ...mapData, spawnPoints, spawnZones };
}

export function removeSpawnPoint(mapData, name) {
  const spawnPoints = { ...mapData.spawnPoints };
  delete spawnPoints[name];

  const spawnZones = {};
  for (const [zoneName, points] of Object.entries(mapData.spawnZones ?? {})) {
    spawnZones[zoneName] = points.filter((p) => p !== name);
  }

  return { ...mapData, spawnPoints, spawnZones };
}
