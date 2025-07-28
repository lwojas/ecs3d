import { Entity } from "../entities/Entity.js";
import { componentClasses } from "./ComponentClasses.js";
import { EntityStore } from "./EntityStore.js";
import { InitManager } from "../system/init/InitManager.js";

export class PrefabFactory {
  constructor(entityManager, componentDefaults, levelData) {
    this.entityManager = entityManager;
    this.componentDefaults = componentDefaults;
    this.levelData = levelData;
  }

  createEntity(entityData) {
    const { type, components, uniqueId } = entityData;

    // Fetch default components for this type, fallback to empty object
    const defaultComponents = this.componentDefaults[type] || {};

    // Check for previous component snapshots
    let inventoryComponents = {};
    EntityStore.inventories.forEach((entity) => {
      entity.forEach((inventoryEntity) => {
        if (uniqueId === inventoryEntity.id) {
          inventoryComponents = inventoryEntity.components;
        }
      });
    });

    // Merge default components with provided components (allowing overrides)
    const mergedComponents = {
      ...defaultComponents,
      ...components,
      ...inventoryComponents,
    };

    // Create new entity
    const entity = new Entity(uniqueId);
    entity.snapshot = mergedComponents;
    // Add merged components to the entity
    for (const [componentName, componentData] of Object.entries(
      mergedComponents
    )) {
      if (componentClasses[componentName]) {
        entity.addComponent(
          new componentClasses[componentName](entity, componentData),
          componentData
        );
      }
    }

    this.entityManager.addEntity(entity);
    return entity;
  }

  loadLevel(levelData = this.levelData) {
    return levelData.entities.map((entityData) =>
      this.createEntity(entityData)
    );
  }
}
