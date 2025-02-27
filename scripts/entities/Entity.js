import { ServiceLocator } from "../services/ServiceLocator.js";
import { componentClasses } from "../services/ComponentClasses.js";

export class Entity {
  static nextId = 0;
  constructor(uniqueId) {
    this.tempId = Entity.nextId++;
    this.id = uniqueId || `entity_${this.tempId}`;
    this.snapshot = {};
    this.components = {};
    // We need to declare entity manager before we create entities
    this.entityManager = ServiceLocator.resolve("game", "EntityManager");
  }

  addComponent(component, componentData) {
    // Remove an previous version of this component
    if (
      this.components[component.constructor.name] &&
      this.components[component.constructor.name].unmount
    ) {
      this.components[component.constructor.name].unmount();
      delete this.components[component.constructor.name];
    }
    this.components[component.constructor.name] = component;
    this.components[component.constructor.name].entity = this;
    this.snapshot[component.constructor.name] = componentData;
    if (this.components[component.constructor.name].onmount) {
      this.components[component.constructor.name].onmount(this);
    }
    this.entityManager.updateEntityLists(this);
  }

  getComponent(name) {
    return this.components[name];
  }

  removeComponent(name) {
    if (this.components[name].unmount) this.components[name].unmount();
    delete this.components[name];
    this.entityManager.updateEntityLists(this);
  }

  hasComponent(name) {
    return this.components.hasOwnProperty(name);
  }

  refreshComponents(excludeComponent = null) {
    console.log(`Resetting entity components, keeping ${excludeComponent}`);

    // Remove all components except the one making the call
    for (let componentName in this.components) {
      if (componentName !== excludeComponent) {
        this.removeComponent(componentName);
      }
    }
    // Reattach components from the stored snapshot
    for (let [componentName, componentData] of Object.entries(this.snapshot)) {
      if (
        componentName !== excludeComponent &&
        componentName !== "SpriteComponent"
      ) {
        this.addComponent(
          new componentClasses[componentName](this, componentData)
        );
      }
    }
    this.entityManager.updateEntityLists(this);
  }
}
