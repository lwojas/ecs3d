// Answers "when/where should this entity be created" and hands the
// resolved definition to PrefabFactory, which only ever answers "given
// this configuration, construct this entity." Authored entities, players,
// bots, wave entities and respawns all go through the same spawn().
//
// Session-level scenario modifiers (see applyModifiers below) only ever
// touch construction-time *configuration* fields (e.g. HealthComponent.
// maximum) -- never a live component's runtime state after the fact.
// One documented key to start; add more the same way if a real need
// shows up. This is intentionally not a generic modifier engine.
//
// Deliberately one narrow domain: stat/config overrides on components
// that already exist in `components` (health, and whatever gets added
// the same way later). AI-behaviour tuning (accuracy, reaction time,
// aggression, ...) is a different domain -- it belongs on AIComponent's
// own fields, set as an ordinary `components.AIComponent` override at
// the call site (see GameSession.buildWorld()), not funnelled through
// this function.
function applyModifiers(components, modifiers) {
  if (!modifiers) return components;
  const result = { ...components };

  if (modifiers.healthMultiplier && result.HealthComponent) {
    const maximum = result.HealthComponent.maximum ?? 100;
    result.HealthComponent = {
      ...result.HealthComponent,
      maximum: maximum * modifiers.healthMultiplier,
    };
  }

  return result;
}

export class EntitySpawner {
  constructor({ prefabFactory, raycaster, mapData }) {
    this.prefabFactory = prefabFactory;
    this.raycaster = raycaster;
    this.mapData = mapData;
    this.zoneIndex = {};
  }

  // request: { prefab | type, uniqueId, spawnPoint, spawnZone, components, modifiers }
  // Authored entity data ({ type, uniqueId, components: { SpawnComponent: { point } } })
  // already matches this shape and can be passed straight in -- that's
  // what spawnAuthored() below relies on.
  spawn(request = {}) {
    const {
      prefab,
      type,
      uniqueId,
      spawnPoint,
      spawnZone,
      components = {},
      modifiers,
    } = request;

    const resolvedType = type ?? prefab;
    const point =
      spawnPoint ?? components.SpawnComponent?.point ?? this.pickZonePoint(spawnZone);

    const resolvedComponents = { ...components };

    if (point) {
      resolvedComponents.SpawnComponent = {
        ...resolvedComponents.SpawnComponent,
        point,
      };

      const position = this.resolveSpawnPosition(point);
      if (position) {
        resolvedComponents.MovementComponent = {
          ...resolvedComponents.MovementComponent,
          x: position.x,
          y: position.y,
          angle: position.angle,
        };
      }
    }

    const base = {
      ...this.prefabFactory.getDefaultComponents(resolvedType),
      ...resolvedComponents,
    };
    const finalComponents = applyModifiers(base, modifiers);

    return this.prefabFactory.createEntity({
      type: resolvedType,
      uniqueId,
      components: finalComponents,
    });
  }

  spawnAuthored(entityDataList) {
    return entityDataList.map((entityData) => this.spawn(entityData));
  }

  // Re-resolves the entity's own SpawnComponent and brings it back --
  // the minimal respawn seam. No timers, no rules decisions here; a
  // caller (rules) decides *when* to call this.
  respawn(entity, { modifiers } = {}) {
    const spawnComponent = entity.getComponent("SpawnComponent");
    const point = spawnComponent?.point;
    const position = point ? this.resolveSpawnPosition(point) : null;

    const movement = entity.getComponent("MovementComponent");
    if (movement && position) {
      movement.x = position.x;
      movement.y = position.y;
      movement.angle = position.angle;
    }

    const health = entity.getComponent("HealthComponent");
    if (health) {
      const multiplier = modifiers?.healthMultiplier ?? 1;
      health.maximum = health.maximum * multiplier;
      health.current = health.maximum;
    }

    entity.enable();
    return entity;
  }

  resolveSpawnPosition(pointName) {
    const point = this.mapData.spawnPoints?.[pointName];
    if (!point) {
      console.warn(`EntitySpawner: unknown spawn point "${pointName}".`);
      return null;
    }
    const world = this.raycaster.cellToWorld(point.cellX, point.cellY);
    return { x: world.x, y: world.y, angle: point.angle ?? 0 };
  }

  // A zone is just a named group of point names -- round-robin through
  // them so e.g. a wave of enemies doesn't stack on one exact spot. Not a
  // real area/region system; that can replace this later without callers
  // (spawn()) needing to change.
  pickZonePoint(zoneName) {
    if (!zoneName) return null;
    const points = this.mapData.spawnZones?.[zoneName];
    if (!points || !points.length) return null;

    const index = this.zoneIndex[zoneName] || 0;
    this.zoneIndex[zoneName] = (index + 1) % points.length;
    return points[index];
  }
}
