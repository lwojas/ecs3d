// A reusable, on-demand batch of entities spawned together through an
// EntitySpawner -- one wave, one alarm response, one scripted encounter.
// Not an ECS system: nothing here runs from an update loop, every
// method is an explicit operation a caller invokes. Callers decide
// *whether*/*when* to spawn (that's a gameplay decision, e.g.
// WaveRules); a SpawnGroup only owns the mechanics of doing so and
// remembering what it spawned, so the caller can later say "these are
// mine, clear them" without keeping its own list.
//
// spawnZone/spawnPoint resolution stays entirely caller-supplied --
// SpawnGroup has no notion of a "default zone" or any other
// spawn-selection convention. That keeps it reusable outside waves;
// see WaveRules.resolveSpawnZone() for the wave-specific convention
// that decides what to pass in.
//
// A SpawnGroup is scoped to the EntitySpawner (one map/world) it's
// built with. Create a new one whenever the world changes rather than
// reusing an instance across maps, so it never ends up holding a
// spawner -- or entities -- from a world that's already been torn
// down.
export class SpawnGroup {
  constructor({ spawner }) {
    this.spawner = spawner;
    this.entities = [];
  }

  // request: { prefab, count = 1, spawnZone, spawnPoint, modifiers, components }
  // Returns the spawned entities (length === count).
  spawn({ prefab, count = 1, spawnZone, spawnPoint, modifiers, components } = {}) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const entity = this.spawner.spawn({
        prefab,
        spawnZone,
        spawnPoint,
        modifiers,
        components,
      });
      this.entities.push(entity);
      spawned.push(entity);
    }
    return spawned;
  }

  // Stops tracking `entity` without disabling it -- for when the
  // caller already knows it's gone (e.g. CombatSystem disabled it on
  // death) and just needs it out of the group.
  untrack(entity) {
    this.entities = this.entities.filter((tracked) => tracked !== entity);
  }

  // Stops tracking `entity` and hands it back to the spawner's reusable
  // pool -- the usual case for a member that just died: it's no longer
  // part of this encounter, and a later spawn() of the same prefab (by
  // this group or any other sharing the same spawner) can reuse it
  // instead of constructing a new entity.
  release(entity) {
    this.untrack(entity);
    this.spawner.release(entity);
  }

  // Disables every currently-tracked entity and stops tracking all of
  // them.
  clear() {
    this.entities.forEach((entity) => entity.disable());
    this.entities = [];
  }
}
