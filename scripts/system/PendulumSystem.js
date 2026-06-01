import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { drawDebugLine } from "./utils/debugTools.js";

export class PendulumSystem extends System {
  constructor() {
    super();

    this.debugSystem = ServiceLocator.resolve("game", "DebugSystem");
    // console.log(this.debugLayer);

    this.entities = this.entityManager.registerSystem(this, [
      "PendulumStateComponent",
    ]);
    ServiceLocator.resolve("game", "EventSystem").on(
      "G_TAP_INPUT_UP",
      this.tapUpdate.bind(this)
    );
  }

  MOVE(entity, pointerPosition) {
    // console.log("Pendulum move firing");
    const spriteComponent = entity.getComponent("SpriteComponent");
    const maxSpeed = entity.getComponent("MovementComponent")?.maxSpeed || 75;
    var angle = game.physics.arcade.angleToXY(
      spriteComponent.sprite,
      pointerPosition.x,
      pointerPosition.y
    );
    spriteComponent.sprite.rotation = angle;
    drawDebugLine(
      this.debugSystem.debugData.ctx,
      spriteComponent.sprite.x,
      spriteComponent.sprite.y,
      pointerPosition.x,
      pointerPosition.y
    );
    ServiceLocator.resolve("game", "EventSystem").emit("G_USE_WEAPON", entity);
    // console.log(stateComponent);
    game.physics.arcade.accelerationFromRotation(
      angle,
      maxSpeed,
      spriteComponent.sprite.body.acceleration
    );
    spriteComponent.sprite.body.angularVelocity = 0;
    if (!entity.hasComponent("ShipExhaustComponent")) return;
    entity.getComponent("ShipExhaustComponent").emitter.on = true;
  }

  FALL() {}

  tapUpdate(pointerPosition) {
    // console.log("NPC Update firing");
    this.entities.forEach((entity) => {
      let component = entity.getComponent("PendulumStateComponent");
      component.tapPosition = { x: pointerPosition.x, y: pointerPosition.y };
      if (component) {
        // console.log(command);
        const action = component.transitions[component.state]["onTap"];
        if (action) {
          // console.log(action);
          action();
        } else {
          console.log("No state found for this action", command);
        }

        // let state = component.state;

        // if (this[state]) {
        //   this[state](entity, pointerPosition);
        // }
      }
    });
  }

  update() {
    this.entities.forEach((entity) => {
      const component = entity.getComponent("PendulumStateComponent");
      if (this[component.state]) {
        this[component.state](entity, component.tapPosition);
      }
    });
  }
}
