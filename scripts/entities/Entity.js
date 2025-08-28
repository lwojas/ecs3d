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
    let spriteExists = false;
    // Remove a previous version of this component
    if (this.components[component.constructor.name]) {
      // Special sauce for existing sprites
      if (component.constructor.name === "SpriteComponent") {
        spriteExists = true;
        // Record the last known position of the sprite
        let position = this.getComponent("Position");
        position.x = this.getComponent("SpriteComponent").sprite.world.x;
        position.y = this.getComponent("SpriteComponent").sprite.world.y;
      }
      delete this.components[component.constructor.name];
    }
    this.snapshot[component.constructor.name] = componentData;
    this.components[component.constructor.name] = component;
    this.components[component.constructor.name].entity = this;

    if (spriteExists) {
      console.log("Init entity");
      this.entityManager.initManager.initEntity(this);
    }
    this.entityManager.updateEntityLists(this);
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
