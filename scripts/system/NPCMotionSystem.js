import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { drawDebugLine } from "./utils/debugTools.js";

export class NPCMotionSystem extends System {
  constructor() {
    super();

    this.debugSystem = ServiceLocator.resolve("game", "DebugSystem");
    // console.log(this.debugLayer);

    this.entities = this.entityManager.registerSystem(
      this,
      ["NPCMotionComponent", "AIStateComponent", "SpriteComponent"],
      "AIStateComponent",
    );
    // console.log(this.componentLists);
  }

  ATTACK(entity, stateComponent) {
    // console.log("NPC ATTACK firing");
    const spriteComponent = entity.getComponent("SpriteComponent");
    const targetSprite =
      stateComponent.intent.entity.getComponent("SpriteComponent").sprite;
    const maxSpeed = entity.getComponent("MovementComponent")?.maxSpeed || 75;
    var angle = game.physics.arcade.angleBetween(
      spriteComponent.sprite,
      targetSprite,
    );
    spriteComponent.sprite.rotation = angle;
    // drawDebugLine(
    //   this.debugSystem.debugData.ctx,
    //   spriteComponent.sprite.x,
    //   spriteComponent.sprite.y,
    //   targetSprite.x,
    //   targetSprite.y
    // );
    // ServiceLocator.resolve("game", "EventSystem").emit("G_USE_WEAPON", entity);
    // console.log(stateComponent);
    game.physics.arcade.accelerationFromRotation(
      spriteComponent.sprite.rotation,
      maxSpeed,
      spriteComponent.sprite.body.acceleration,
    );
    spriteComponent.sprite.body.angularVelocity = 0;
    if (!entity.hasComponent("ShipExhaustComponent")) return;
    entity.getComponent("ShipExhaustComponent").emitter.on = true;
  }

  FLEE(entity, stateComponent) {
    // console.log("NPC is fleeing");
    const spriteComponent = entity.getComponent("SpriteComponent");
    const targetSprite =
      stateComponent.intent.entity.getComponent("SpriteComponent").sprite;
    const maxSpeed = entity.getComponent("MovementComponent")?.maxSpeed || 75;
    var angle = game.physics.arcade.angleToXY(
      spriteComponent.sprite,
      game.world.width - targetSprite.x,
      game.world.height - targetSprite.y,
    );
    spriteComponent.sprite.rotation = angle;
    game.physics.arcade.accelerationFromRotation(
      spriteComponent.sprite.rotation,
      maxSpeed,
      spriteComponent.sprite.body.acceleration,
    );
    // spriteComponent.sprite.body.velocity.y = 30;
  }

  IDLE(entity) {
    const spriteComponent = entity.getComponent("SpriteComponent");
    spriteComponent.sprite.body.acceleration.set(0);
    spriteComponent.sprite.body.angularVelocity = 0;
    if (!entity.hasComponent("ShipExhaustComponent")) return;
    entity.getComponent("ShipExhaustComponent").emitter.on = false;
  }

  update() {
    // console.log("NPC Update firing");
    const components = this.componentLists.AIStateComponent;
    const len = components.length;

    for (let i = 0; i < len; i++) {
      let component = components[i];
      let state = component.intent.intent;

      if (this[state]) {
        this[state](this.entities[i], component);
      } else {
        console.log("No state found");
      }
    }
    // this.entities.forEach((entity) => {});
  }
}
