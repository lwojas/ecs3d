import { GameRules } from "./GameRules.js";

// Case B's minimal rules: on start, request each configured wave's
// entities through the same EntitySpawner every other spawn path uses.
// Deliberately dumb -- every wave spawns immediately, there's no
// wave-clear/timing logic. Just the "rules can request entities
// dynamically through the spawning mechanism" seam; a real wave director
// (timing, escalation, clear-to-advance) is future work.
export class WaveRules extends GameRules {
  constructor({ waves = [], spawner = null } = {}) {
    super();
    this.waves = waves;
    this.spawner = spawner;
  }

  events = {};

  onStart(gameplay) {
    for (const wave of this.waves) {
      this.spawnWave(wave);
    }
  }

  spawnWave(wave) {
    if (!this.spawner) return;

    const count = wave.count ?? 1;
    for (let i = 0; i < count; i++) {
      this.spawner.spawn({
        prefab: wave.prefab,
        spawnZone: wave.spawnZone,
        spawnPoint: wave.spawnPoint,
        modifiers: wave.modifiers,
      });
    }
  }
}
