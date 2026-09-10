import { ServiceLocator } from "../services/ServiceLocator.js";
import { componentClasses } from "../services/ComponentClasses.js";

export class Entity {
  static nextId = 0;
  constructor(uniqueId) {
    this.tempId = Entity.nextId++;
    this.id = uniqueId || `entity_${this.tempId}`;
    this.snapshot = {};
    this.components = {};
    this.isEnabled = true;
    // We need to declare entity manager before we create entities
    this.entityManager = ServiceLocator.resolve("game", "EntityManager");
  }

  disable() {
    for (let componentName in this.components) {
      const component = this.components[componentName];
      // console.log(component);
      if (component.enabled) {
        component.enabled = false;
      }
    }
  }

  // Symmetric to disable() -- used by EntitySpawner.respawn() to bring a
  // dead entity's components back to life without reconstructing it.
  enable() {
    for (let componentName in this.components) {
      const component = this.components[componentName];
      if (!component.enabled) {
        component.enabled = true;
      }
    }
  }

  addComponent(component, componentData) {
    // Remove a previous version of this component
    if (this.components[component.constructor.name]) {
      delete this.components[component.constructor.name];
    }
    this.snapshot[component.constructor.name] = componentData;
    this.components[component.constructor.name] = component;
    this.components[component.constructor.name].entity = this;

    // this.entityManager.updateEntityLists(this);
  }

  getComponent(name) {
    return this.components[name];
  }

  removeComponent(name) {
    if (this.components[name].unmount) this.components[name].unmount();
    delete this.components[name];
    delete this.snapshot[name];
    this.entityManager.updateEntityLists(this);
  }

  hasComponent(name) {
    return this.components.hasOwnProperty(name);
  }
}
