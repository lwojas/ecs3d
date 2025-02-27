import { Entity } from "../entities/Entity.js";
import { componentClasses } from "./ComponentClasses.js";
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

    // Merge default components with provided components (allowing overrides)
    const mergedComponents = { ...defaultComponents, ...components };
    // console.log(components);
    // Create new entity
    const entity = new Entity(uniqueId);

    // Add merged components to the entity
    for (const [componentName, componentData] of Object.entries(
      mergedComponents
    )) {
      // console.log(componentName, componentData);
      //   const ComponentClass = this.getComponentClass(componentName);
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
