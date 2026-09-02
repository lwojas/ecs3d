import { GameRules } from "./GameRules.js";

// Case B's minimal rules: on start, request each configured wave's
// entities through the same EntitySpawner every other spawn path uses.
// Deliberately dumb -- every wave spawns immediately, there's no
// wave-clear/timing logic. Just the "rules can request entities
// dynamically through the spawning mechanism" seam; a real wave director
// (timing, escalation, clear-to-advance) is future work.
export class WaveRules extends GameRules {
  // `defaultSpawnZone` is WaveRules' own convention for "where enemies
  // enter the world absent a more specific decision" -- not something
  // map data declares (a map only ever exposes generic named zones) and
  // not something the menu should invent on the map's behalf. A hand-
  // authored session can still override it per-scenario via `rules`, and
  // a future version of resolveSpawnZone() can replace the convention
  // entirely (round-robin, player-proximity, difficulty-based, ...)
  // without any caller -- menu or session config -- needing to change.
  constructor({ waves = [], defaultSpawnZone = "courtyard" } = {}) {
    super();
    this.waves = waves;
    this.defaultSpawnZone = defaultSpawnZone;
    this.spawner = null;
    this.mapData = null;
  }

  events = {};

  // Rules persist across maps; the spawner doesn't -- MapWorld hands us
  // the current one after each build and takes it back before tearing
  // the world down, so we never hold a reference to a destroyed map's
  // spawner. mapData is kept for the same reason resolveSpawnZone() needs
  // it: to reason about the *current* map's named zones, never a stale
  // one from a map this rules instance already left.
  attachWorld({ spawner, mapData }) {
    this.spawner = spawner;
    this.mapData = mapData;
  }

  detachWorld() {
    this.spawner = null;
    this.mapData = null;
  }

  // onMapLoaded (not onStart) -- Gameplay.loadMap() calls this on *every*
  // map load, whereas Gameplay.start() only ever fires once per session
  // (it no-ops once state has left IDLE). onStart is for one-time
  // session setup; per-map spawning belongs here so a second map on the
  // same session gets its waves too.
  onMapLoaded(gameplay, map) {
    for (const wave of this.waves) {
      this.spawnWave(wave);
    }
  }

  spawnWave(wave) {
    if (!this.spawner) return;

    const count = wave.count ?? 1;
    const spawnZone = this.resolveSpawnZone(wave);
    for (let i = 0; i < count; i++) {
      this.spawner.spawn({
        prefab: wave.prefab,
        spawnZone,
        spawnPoint: wave.spawnPoint,
        modifiers: wave.modifiers,
      });
    }
  }

  // Where a wave spawns is a runtime gameplay decision, made here, not by
  // session config/the menu. `wave.spawnZone` remains a legitimate
  // per-wave authoring override (e.g. a hand-built scenario that wants
  // wave 2 to come from the north); the fallback is this rules instance's
  // own convention rather than anything the map or menu dictates. A
  // future version can factor in player position, difficulty, wave type,
  // etc. here without changing this method's signature or any caller.
  resolveSpawnZone(wave) {
    return wave.spawnZone ?? this.defaultSpawnZone;
  }
}
