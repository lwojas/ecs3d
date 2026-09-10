import { GameRules } from "./GameRules.js";

// Sequential wave defence: waves spawn one at a time, advancing only once
// the current wave's enemies are all dead. A player death clears whatever
// is left standing and restarts from wave 1; running out of lives or
// clearing every wave ends the session via gameplay.finish().
//
// Kills/deaths route through the single "entity.killed" message (emitted
// once, on the alive->dead transition, by CombatSystem) rather than every
// rule re-deriving death from "entity.damaged" + a health check -- see
// onEntityKilled(). gameplay.score/gameplay.lives use a generic,
// player-id-keyed shape so other rule types can adopt the same
// convention later without a different shape to reconcile.
export class WaveRules extends GameRules {
  // `defaultSpawnZone` is WaveRules' own convention for "where enemies
  // enter the world absent a more specific decision" -- not something
  // map data declares (a map only ever exposes generic named zones) and
  // not something the menu should invent on the map's behalf. A hand-
  // authored session can still override it per-scenario via `rules`, and
  // a future version of resolveSpawnZone() can replace the convention
  // entirely (round-robin, player-proximity, difficulty-based, ...)
  // without any caller -- menu or session config -- needing to change.
  constructor({ waves = [], defaultSpawnZone = "courtyard", lives = 3 } = {}) {
    super();
    this.waves = waves;
    this.defaultSpawnZone = defaultSpawnZone;
    this.startingLives = lives;
    this.spawner = null;
    this.mapData = null;
    this.activeEnemies = [];
    this.waveIndex = 0;
  }

  events = {
    "entity.killed": "onEntityKilled",
  };

  // Session-scoped: fires once, before the first map's waves spawn.
  // gameplay.score/gameplay.lives are shared Gameplay concepts (see
  // Gameplay.js) -- WaveRules just owns seeding them for this mode.
  onStart(gameplay) {
    for (const player of gameplay.players) {
      gameplay.lives[player.id] = this.startingLives;
      gameplay.score[player.id] = { kills: 0, deaths: 0 };
    }
  }

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
    this.waveIndex = 0;
    this.activeEnemies = [];
    this.startWave(gameplay, 0);
  }

  onEntityKilled(gameplay, message) {
    const victim = message.target.entity;
    const responsible = message.source?.entity ?? null;

    victim.disable();

    const player = gameplay.getPlayer(victim.id);
    if (player) {
      this.onPlayerKilled(gameplay, player, responsible);
    } else {
      this.onEnemyKilled(gameplay, victim, responsible);
    }
  }

  onPlayerKilled(gameplay, player, killer) {
    const score = gameplay.score[player.id];
    score.deaths += 1;

    const wave = this.waveIndex + 1;
    const killerId = killer?.id ?? "unknown";
    console.log(
      `[WaveRules] ${player.id} was killed by ${killerId} on wave ${wave}`,
    );
    gameplay.hud?.notify(`${player.id} was killed by ${killerId}`);

    this.clearActiveEnemies();

    gameplay.lives[player.id] -= 1;
    if (gameplay.lives[player.id] <= 0) {
      this.endGame(gameplay, "defeat");
      return;
    }

    gameplay.addAction({
      type: "player.respawn",
      playerId: player.id,
    });

    this.startWave(gameplay, 0);
  }

  onEnemyKilled(gameplay, enemy, killer) {
    this.activeEnemies = this.activeEnemies.filter((active) => active !== enemy);

    const player = killer && gameplay.getPlayer(killer.id);
    if (player) {
      const score = gameplay.score[player.id];
      score.kills += 1;

      const wave = this.waveIndex + 1;
      console.log(
        `[WaveRules] ${player.id} killed ${enemy.id} on wave ${wave} (${score.kills} kills)`,
      );
      gameplay.hud?.notify(`${player.id} killed ${enemy.id}`);
    }

    if (this.activeEnemies.length === 0) {
      this.advanceWave(gameplay);
    }
  }

  advanceWave(gameplay) {
    const nextIndex = this.waveIndex + 1;
    if (nextIndex >= this.waves.length) {
      this.endGame(gameplay, "victory");
      return;
    }
    this.startWave(gameplay, nextIndex);
  }

  startWave(gameplay, index) {
    this.waveIndex = index;
    const wave = this.waves[index];
    if (!wave) return;
    this.spawnWave(wave);
  }

  clearActiveEnemies() {
    this.activeEnemies.forEach((enemy) => enemy.disable());
    this.activeEnemies = [];
  }

  endGame(gameplay, result) {
    this.clearActiveEnemies();
    gameplay.finish({
      result,
      wave: this.waveIndex + 1,
      totalWaves: this.waves.length,
      score: { ...gameplay.score },
    });
  }

  spawnWave(wave) {
    if (!this.mapData.spawnPoints.enemyStart) {
      console.log("No enemy start found, aborting wave spawn");
      return;
    }
    if (!this.spawner) return;

    const count = wave.count ?? 1;
    const spawnZone = this.resolveSpawnZone(wave);
    for (let i = 0; i < count; i++) {
      this.activeEnemies.push(
        this.spawner.spawn({
          prefab: wave.prefab,
          spawnZone,
          spawnPoint: wave.spawnPoint,
          modifiers: wave.modifiers,
        }),
      );
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
