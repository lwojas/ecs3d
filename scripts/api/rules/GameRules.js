export class GameRules {
  events = {};

  onStart(gameplay) {}

  onMapLoaded(gameplay, map) {}

  update(gameplay, dt) {}

  onGameOver(gameplay, outcome) {}

  // The seam between persistent rules and the currently loaded map's
  // world. MapWorld calls attachWorld() with the map-specific context
  // (e.g. { spawner }) right after building it, and detachWorld() right
  // before tearing it down -- so rules that need the current world
  // (e.g. WaveRules) never keep a reference to a destroyed map's
  // spawner. No-op by default.
  attachWorld(world) {}

  detachWorld() {}
}
