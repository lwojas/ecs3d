import { Entity } from "../entities/Entity.js";
import { componentClasses } from "./ComponentClasses.js";
import { EntityStore } from "./EntityStore.js";

export class PrefabFactory {
  constructor(entityManager, componentDefaults) {
    this.entityManager = entityManager;
    this.componentDefaults = componentDefaults;
    // console.log(componentDefaults);
  }

  // Exposed so EntitySpawner can apply session modifiers against the
  // *resolved* template (defaults a caller never explicitly overrides),
  // not just whatever override layer it happens to be given.
  getDefaultComponents(type) {
    return this.componentDefaults[type] || {};
  }

  // Fetch default components for `type`, overlay `components`, then any
  // previously-saved snapshot for `uniqueId` (allowing overrides) -- the
  // one merge rule shared by both constructing a new entity and
  // resetting an existing one back to a prefab's canonical state.
  buildComponents(type, components, uniqueId) {
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

    return {
      ...defaultComponents,
      ...components,
      ...inventoryComponents,
    };
  }

  // (Re)constructs every component named in `mergedComponents` fresh, via
  // its own constructor -- the only reset a component ever needs, since
  // each one derives all of its runtime state from (entity, data) alone.
  // addComponent() replaces whatever component of that name the entity
  // already had, so this is a complete reset, not just an overlay.
  applyComponents(entity, mergedComponents) {
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
  }

  createEntity(entityData) {
    const { type, components, uniqueId } = entityData;
    const mergedComponents = this.buildComponents(type, components, uniqueId);

    // Create new entity
    const entity = new Entity(uniqueId);
    entity.snapshot = mergedComponents;
    entity.prefabId = type;
    this.applyComponents(entity, mergedComponents);

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

  // Rebuilds every component of an existing entity from scratch -- same
  // construction path createEntity() uses for a brand new one, replayed
  // against a live Entity object instead. `entity.prefabId` supplies the
  // canonical defaults, so a recycled entity returns to that prefab's
  // stock state before `components` (this spawn's own configuration) is
  // layered on. Identity (id/tempId) and entity-manager registration are
  // untouched -- only component state is replaced.
  resetEntity(entity, components) {
    const mergedComponents = this.buildComponents(
      entity.prefabId,
      components,
      entity.id,
    );
    entity.snapshot = mergedComponents;
    this.applyComponents(entity, mergedComponents);
    return entity;
  }
}
