import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { drawDebugLine } from "./utils/debugTools.js";
import { isWithinRange } from "./utils/rangeTools.js";
import { getPatrolActions } from "./utils/patrolActions.js";
import { moveSpriteByRotation } from "./utils/spriteMovement.js";

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
    const sprite = entity.getComponent("SpriteComponent").sprite;
    const targetSprite =
      entity
        .getComponent("TargetComponent")
        ?.target?.getComponent("SpriteComponent")?.sprite || null;
    // console.log(targetSprite.alive);
    if (!targetSprite) return;
    if (!targetSprite.alive) {
      // stateComponent.state = "PATROL";
      if (stateComponent.decision.entity.hasComponent("PlayerComponent")) {
        game.camera.follow(sprite);
      }
    }
    const maxSpeed = entity.getComponent("MovementComponent")?.speed || 75;
    moveSpriteByRotation(sprite, targetSprite, maxSpeed);

    if (isWithinRange(sprite, targetSprite, 400)) {
      drawDebugLine(
        this.debugSystem.debugData.ctx,
        sprite.x,
        sprite.y,
        targetSprite.x,
        targetSprite.y,
      );
      // console.log("In range to attack");
      ServiceLocator.resolve("game", "EventSystem").emit(
        "G_USE_WEAPON",
        entity,
      );
    }
    if (!entity.hasComponent("ShipExhaustComponent")) return;
    entity.getComponent("ShipExhaustComponent").emitter.on = true;
  }

  FLEE(entity, stateComponent) {
    // console.log("NPC is fleeing");
    const spriteComponent = entity.getComponent("SpriteComponent");
    const targetSprite =
      entity
        .getComponent("TargetComponent")
        ?.target?.getComponent("SpriteComponent")?.sprite || null;
    if (!targetSprite) return;
    const maxSpeed = entity.getComponent("MovementComponent")?.speed || 75;
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

  MOVETO(entity, stateComponent) {
    // console.log("[Moveto is running]");
    if (!entity.hasComponent("TargetComponent")) return;

    const spriteComponent = entity.getComponent("SpriteComponent");
    const target = entity.getComponent("TargetComponent")?.target;
    const targetSprite = target.getComponent("SpriteComponent")?.sprite;
    const maxSpeed = entity.getComponent("MovementComponent")?.speed || 75;
    moveSpriteByRotation(spriteComponent.sprite, targetSprite, maxSpeed);
    if (!entity.hasComponent("ShipExhaustComponent")) return;
    entity.getComponent("ShipExhaustComponent").emitter.on = true;
  }

  PATROL(entity) {
    const patrolComponent = entity.getComponent("PatrolComponent");
    if (!patrolComponent) return;
    const spriteComponent = entity.getComponent("SpriteComponent");
    const movementComponent = entity.getComponent("MovementComponent");

    const patrolActions = getPatrolActions();
    const points = patrolActions[patrolComponent.currentPatrolAction].points;
    if (!points) return;

    const sprite = spriteComponent.sprite;
    const target = points[patrolComponent.currentIndex];

    const distance = game.physics.arcade.distanceToXY(
      sprite,
      target.x,
      target.y,
    );

    // Move to next patrol point
    if (distance < 25) {
      patrolComponent.currentIndex =
        (patrolComponent.currentIndex + 1) % points.length;
      return;
    }

    const angle = game.physics.arcade.angleToXY(sprite, target.x, target.y);

    sprite.rotation = angle;

    game.physics.arcade.accelerationFromRotation(
      angle,
      movementComponent?.speed || 75,
      sprite.body.acceleration,
    );
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
      if (!component.entity.hasComponent("InputComponent")) {
        // if (this.entities[i].hasComponent("InputComponent")) break;
        let state = component.state;
        // console.log(state);

        if (this[state]) {
          this[state](this.entities[i], component);
        } else {
          console.log("No state found");
        }
      }
    }
    // this.entities.forEach((entity) => {});
  }
}
