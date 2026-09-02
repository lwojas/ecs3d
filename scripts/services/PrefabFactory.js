import { Entity } from "../entities/Entity.js";
import { componentClasses } from "./ComponentClasses.js";
import { EntityStore } from "./EntityStore.js";

export class PrefabFactory {
  constructor(entityManager, componentDefaults) {
    this.entityManager = entityManager;
    this.componentDefaults = componentDefaults;
  }

  // Exposed so EntitySpawner can apply session modifiers against the
  // *resolved* template (defaults a caller never explicitly overrides),
  // not just whatever override layer it happens to be given.
  getDefaultComponents(type) {
    return this.componentDefaults[type] || {};
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
      mergedComponents,
    )) {
      if (componentClasses[componentName]) {
        entity.addComponent(
          new componentClasses[componentName](entity, componentData),
          // For snapshot:
          componentData,
        );
      }
    }

    // A duplicated uniqueId in authored data silently produces two
    // separate Entity objects (EntityManager has no dedup) -- the second
    // wins EntityManager.getEntity(), while the first becomes an orphan
    // that's still fully alive in every system's component lists (a
    // static, never-updated collider is exactly what this looks like for
    // anything with a CollisionComponent). Not fatal -- just loud, since
    // this is easy to introduce by copy-pasting an authored entity.
    if (uniqueId && this.entityManager.getEntity(uniqueId)) {
      console.warn(
        `PrefabFactory: duplicate uniqueId "${uniqueId}" -- creating a second, separate entity.`,
      );
    }

    this.entityManager.addEntity(entity);
    return entity;
  }
}
