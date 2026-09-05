import { ServiceLocator } from "./ServiceLocator.js";
import { componentClasses } from "./ComponentClasses.js";

export class EntityManager {
  constructor() {
    ServiceLocator.register("game", "EntityManager", this);

    this.world = [];
    this.worldHash = new Map();
    this.byId = new Map();
    this.entities = new Set();
    this.systemEntityLists = new Map();
    this.isBatching = false; // Flag to delay updates
    this.dirtyEntities = new Set(); // Track changed entities
    ServiceLocator.resolve("game", "EventSystem").on(
      "G_REFRESH_ENTITY_LISTS",
      this.updateEntityLists.bind(this),
    );
  }

  addEntity(entity) {
    // Initialise the entity - add a sprite and physics if needed

    // console.log(entity);
    this.world.push(entity);
    this.worldHash.set(entity, this.world.length - 1);
    if (entity.id != null) this.byId.set(entity.id, entity);
    this.updateEntityLists(entity);
  }

  removeEntity(entity) {
    this.world.splice(this.worldHash.get(entity));
    this.worldHash.delete(entity);
    if (entity.id != null) this.byId.delete(entity.id);
  }

  // The one authoritative id-keyed lookup -- every entity, however it was
  // created (authored, player, bot, or dynamically spawned by a GameRules
  // subclass), passes through addEntity() above the same way, so this
  // finds all of them uniformly. Callers (MapWorld, respawn/inspection
  // tooling, ...) should use this instead of keeping their own id map.
  getEntity(id) {
    return this.byId.get(id) ?? null;
  }

  updateEntityLists(entity) {
    for (let [system, entityList] of this.systemEntityLists.entries()) {
      const entityComponents = Object.keys(entity.components);
      const hasAllComponents = system.requiredComponents.every((comp) =>
        entityComponents.includes(comp),
      );
      if (hasAllComponents && entity.isEnabled) {
        if (!entityList.includes(entity)) {
          entityList.push(entity);
        }
      }
      if (system.refreshList) system.refreshList();
    }
  }

  registerSystem(system, requiredComponents) {
    system.requiredComponents = requiredComponents;
    // console.log(requiredComponents);
    const filteredEntities = [...this.world].filter((entity) =>
      requiredComponents.every(
        (comp) => entity.hasComponent(comp) && entity.isEnabled,
      ),
    );

    this.systemEntityLists.set(system, filteredEntities);

    return filteredEntities;
  }

  makeComponentList(entities, componentName) {
    let compList = entities.map((entity) => {
      const comp = entity.getComponent(componentName);
      if (comp) return comp;
    });
    return compList;
  }

  makeSpriteList(entities) {
    let spriteList = entities.map((entity) => {
      let sprite = entity.getComponent("SpriteComponent");
      if (sprite) return sprite.sprite;
    });
    return spriteList;
  }

  /** Enables batching, preventing unnecessary list rebuilds. */
  beginBatch() {
    this.isBatching = true;
  }

  /** Ends batching and updates only the affected entities. */
  endBatch() {
    this.isBatching = false;
    for (const entity of this.dirtyEntities) {
      this.updateEntityLists(entity);
    }
    this.dirtyEntities.clear();
  }
}
