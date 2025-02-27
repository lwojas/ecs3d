import { ServiceLocator } from "./ServiceLocator.js";
import { InitManager } from "../system/init/InitManager.js";

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
  }

  addEntity(entity) {
    this.initManager.initEntity(entity);
    // console.log(entity);
    this.world.push(entity);
    this.worldHash.set(entity, this.world.length - 1);

    // this.entities.add(entity);
    // entity.setManager(this);
    // if (!this.isBatching) {
    //   this.updateEntityLists(entity);
    // } else {
    //   this.dirtyEntities.add(entity);
    // }
  }

  removeEntity(entity) {
    this.world.splice(this.worldHash.get(entity));
    this.worldHash.delete(entity);
    // this.entities.delete(entity);
    // for (const entityList of this.systemEntityLists.values()) {
    //   entityList.delete(entity);
    // }
  }

  updateEntityLists(entity) {
    for (let [system, entityList] of this.systemEntityLists.entries()) {
      const newList = [];
      this.world.forEach((worldEnity) => {
        const requiredComponents = system.requiredComponents;
        const hasAllComponents = requiredComponents.every((comp) =>
          worldEnity.hasComponent(comp)
        );
        if (hasAllComponents) {
          newList.push(worldEnity);
        }
      });
      system.actors = this.makeSpriteList(newList);
      system.entities = newList;
      entityList = newList;
      if (system.refreshList) system.refreshList();
    }
  }

  registerSystem(system, requiredComponents) {
    system.requiredComponents = requiredComponents;
    const filteredEntities = [...this.world].filter((entity) =>
      requiredComponents.every((comp) => entity.hasComponent(comp))
    );
    this.systemEntityLists.set(system, filteredEntities);
    system.actors = this.makeSpriteList(filteredEntities);
    return filteredEntities;
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
