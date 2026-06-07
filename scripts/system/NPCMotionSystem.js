import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { drawDebugLine } from "./utils/debugTools.js";
import { isWithinRange } from "./utils/rangeTools.js";
import { getPatrolActions } from "./utils/patrolActions.js";

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
    // console.log(targetSprite.alive);
    if (!targetSprite.alive) {
      stateComponent.intent.intent = "PATROL";
      if (stateComponent.intent.entity.hasComponent("PlayerComponent")) {
        game.camera.follow(spriteComponent.sprite);
      }
    }
    const maxSpeed = entity.getComponent("MovementComponent")?.maxSpeed || 75;
    var angle = game.physics.arcade.angleBetween(
      spriteComponent.sprite,
      targetSprite,
    );
    spriteComponent.sprite.rotation = angle;
    if (isWithinRange(spriteComponent.sprite, targetSprite, 400)) {
      drawDebugLine(
        this.debugSystem.debugData.ctx,
        spriteComponent.sprite.x,
        spriteComponent.sprite.y,
        targetSprite.x,
        targetSprite.y,
      );
      // console.log("In range to attack");
      ServiceLocator.resolve("game", "EventSystem").emit(
        "G_USE_WEAPON",
        entity,
      );
    }

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
      movementComponent?.maxSpeed || 75,
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
