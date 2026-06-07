import { ServiceLocator } from "./ServiceLocator.js";
import { InitManager } from "../system/init/InitManager.js";
import { componentClasses } from "./ComponentClasses.js";

export class EntityManager {
  constructor() {
    ServiceLocator.register("game", "EntityManager", this);
    this.initManager = new InitManager();
    this.world = [];
    this.worldHash = new Map();
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
    this.initManager.initEntity(entity);
    // console.log(entity);
    this.world.push(entity);
    this.worldHash.set(entity, this.world.length - 1);
  }

  removeEntity(entity) {
    this.world.splice(this.worldHash.get(entity));
    this.worldHash.delete(entity);
  }

  updateEntityLists(entity) {
    for (let [system, entityList] of this.systemEntityLists.entries()) {
      console.log(system);
      const newList = [];
      this.world.forEach((worldEnity) => {
        const requiredComponents = system.requiredComponents;
        const hasAllComponents = requiredComponents.every((comp) =>
          worldEnity.hasComponent(comp),
        );
        if (hasAllComponents) {
          if (worldEnity.isEnabled) {
            newList.push(worldEnity);
          }
        }
      });
      system.componentLists = {};
      system.requiredComponents.forEach((component) => {
        system.componentLists[component] = this.makeComponentList(
          newList,
          component,
        );
      });
      system.actors = this.makeSpriteList(newList);
      system.cachedComponents = this.makeComponentList(newList);
      system.entities = newList;
      entityList = newList;
      if (system.refreshList) system.refreshList();
    }
  }

  registerSystem(system, requiredComponents) {
    system.requiredComponents = requiredComponents;
    console.log(requiredComponents);
    const filteredEntities = [...this.world].filter((entity) =>
      requiredComponents.every(
        (comp) => entity.hasComponent(comp) && entity.isEnabled,
      ),
    );
    requiredComponents.forEach((component) => {
      if (!system.componentLists) system.componentLists = {};
      system.componentLists[component] = this.makeComponentList(
        filteredEntities,
        component,
      );
    });

    this.systemEntityLists.set(system, filteredEntities);
    system.actors = this.makeSpriteList(filteredEntities);

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
