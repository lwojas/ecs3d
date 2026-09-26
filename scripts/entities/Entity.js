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
    this.isEnabled = false;
    for (let componentName in this.components) {
      const component = this.components[componentName];
      // console.log(component);
      if (component.enabled) {
        component.enabled = false;
      }
    }
  }

  // Symmetric to disable() -- used by EntitySpawner.respawn()/recycle() to
  // bring a dead entity's components back to life without reconstructing
  // it. isEnabled is otherwise inert for system membership (see
  // EntityManager.updateEntityLists -- it only ever adds, never removes,
  // an entity from a system's list, so every system instead gates its own
  // per-frame work on each component's `.enabled`); it exists so
  // AISystem's sticky-target checks (getStickyTarget/getStickyHuntTarget)
  // can tell a disabled/recycled entity apart from a live one.
  enable() {
    this.isEnabled = true;
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
