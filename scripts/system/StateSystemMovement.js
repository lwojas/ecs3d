import { ServiceLocator } from "../services/ServiceLocator.js";

export class StateSystemMovement {
  constructor(entities) {
    ServiceLocator.register("game", "StateSystemMovement", this);
    this.stateComponents = new Map();
    entities.forEach((entity) => {
      if (entity.hasComponent("StateMovementComponent")) {
        this.stateComponents.set(
          entity,
          entity.getComponent("StateMovementComponent")
        );
      }
    });
  }

  RIGHT(component) {
    const spriteComponent = component.entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.velocity.x = 30;
  }

  LEFT(component) {
    const spriteComponent = component.entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.velocity.x = -30;
  }

  UP(component) {
    const spriteComponent = component.entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.velocity.y = -30;
  }

  DOWN(component) {
    const spriteComponent = component.entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.velocity.y = 30;
  }

  IDLE(component) {
    const spriteComponent = component.entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.velocity.y = 0;
    spriteComponent.sprite.body.velocity.x = 0;
  }

  update(entities, command) {
    // console.log("state changing");
    entities.forEach((entity) => {
      let component = entity.getComponent("StateMovementComponent");
      // console.log(command);
      const action = component.transitions[component.state][command];
      if (action) {
        action();
      } else {
        console.log("No state found for this action");
      }

      let state = component.state;

      if (this[state]) {
        this[state](component);
      }
    });
  }
}
