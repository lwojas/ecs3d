import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";

export class MotionSystemShip extends System {
  constructor() {
    super();

    this.entities = this.entityManager.registerSystem(this, [
      "MotionShipComponent",
    ]);
  }

  RIGHT(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.angularVelocity = 150;
  }

  LEFT(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.angularVelocity = -150;
  }

  RIGHTTHRUST(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.angularVelocity = 150;
    const maxSpeed = entity.getComponent("MovementComponent")?.maxSpeed || 75;
    game.physics.arcade.accelerationFromRotation(
      spriteComponent.sprite.rotation,
      maxSpeed,
      spriteComponent.sprite.body.acceleration
    );
  }

  LEFTTHRUST(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.angularVelocity = -150;
    const maxSpeed = entity.getComponent("MovementComponent")?.maxSpeed || 75;
    game.physics.arcade.accelerationFromRotation(
      spriteComponent.sprite.rotation,
      maxSpeed,
      spriteComponent.sprite.body.acceleration
    );
  }

  UP(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    const maxSpeed = entity.getComponent("MovementComponent")?.maxSpeed || 75;
    game.physics.arcade.accelerationFromRotation(
      spriteComponent.sprite.rotation,
      maxSpeed,
      spriteComponent.sprite.body.acceleration
    );
    spriteComponent.sprite.body.angularVelocity = 0;
    if (!entity.hasComponent("ShipExhaustComponent")) return;
    entity.getComponent("ShipExhaustComponent").emitter.on = true;
  }

  DOWN(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    // spriteComponent.sprite.body.velocity.y = 30;
  }

  IDLE(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.acceleration.set(0);
    spriteComponent.sprite.body.angularVelocity = 0;
    if (!entity.hasComponent("ShipExhaustComponent")) return;
    entity.getComponent("ShipExhaustComponent").emitter.on = false;
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

        // let state = component.state;

        // if (this[state]) {
        //   this[state](entity);
        // }
      }
    });
  }

  update() {
    this.entities.forEach((entity) => {
      let component = entity.getComponent("MotionShipComponent");
      let state = component.state;

      if (this[state]) {
        this[state](entity);
      }
    });
  }
}
