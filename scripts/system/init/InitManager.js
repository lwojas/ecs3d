import { ExhaustSystem } from "./ExhaustSystem.js";
import { PhysicsManager } from "./PhysicsManager.js";
import { SpriteManager } from "./SpriteManager.js";
import { followEntity } from "../utils/cameraFollow.js";
import { ServiceLocator } from "../../services/ServiceLocator.js";

export class InitManager {
  constructor() {
    this.spriteManager = new SpriteManager();
    this.physicsManager = new PhysicsManager();
    this.exhaustSystem = new ExhaustSystem();

    // entities.forEach((entity) => {
    //   this.initEntity(entity);
    // });
  }

  killEntity(entity) {
    if (entity.hasComponent("SpriteComponent")) {
      this.spriteManager.killSprite(entity);
    }
    if (entity.hasComponent("ShipExhaustComponent")) {
      this.exhaustSystem.stopExhaust(entity);
    }
  }

  initEntity(entity) {
    if (!entity.hasComponent("SpriteComponent")) return;
    this.spriteManager.createSprite(entity);
    this.physicsManager.addDynamicBody(entity);
    this.physicsManager.addStaticBody(entity);
    this.exhaustSystem.createExhaust(entity);
    if (entity.hasComponent("PlayerComponent")) followEntity(entity);
    ServiceLocator.resolve("game", "EventSystem").emit(
      "G_SPRITE_UPDATED",
      entity,
    );
    const spriteComponent = entity.getComponent("SpriteComponent");
    if (!spriteComponent.enabled) spriteComponent.sprite.kill();
    // console.log(entity);
    if (!entity.hasComponent("LightComponent")) return;
    entity.getComponent("LightComponent").position = spriteComponent.sprite;
  }
}
