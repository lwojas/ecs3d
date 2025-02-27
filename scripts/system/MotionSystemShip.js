import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";

export class MotionSystemShip extends System {
  constructor() {
    super();
  }

  RIGHT(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.angularVelocity = 30;
  }

  LEFT(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.angularVelocity = -30;
  }

  UP(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    entity.getComponent("ShipExhaustComponent").emitter.on = true;
    const maxSpeed = entity.getComponent("MovementComponent").maxSpeed || 75;
    game.physics.arcade.accelerationFromRotation(
      spriteComponent.sprite.rotation,
      maxSpeed,
      spriteComponent.sprite.body.acceleration
    );
  }

  DOWN(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.velocity.y = 30;
  }

  IDLE(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    entity.getComponent("ShipExhaustComponent").emitter.on = false;
    // spriteComponent.sprite.body.velocity.y = 0;
    // spriteComponent.sprite.body.velocity.x = 0;
    spriteComponent.sprite.body.acceleration.set(0);
    spriteComponent.sprite.body.angularVelocity = 0;
  }

  receiveUpdate(entities, command) {
    // console.log("state changing");
    entities.forEach((entity) => {
      let component = entity.getComponent("MotionShipComponent");
      if (component) {
        // console.log(command);
        const action = component.transitions[component.state][command];
        if (action) {
          action();
        } else {
          console.log("No state found for this action", command);
        }

        let state = component.state;

        if (this[state]) {
          this[state](entity);
        }
      }
    });
  }
}
