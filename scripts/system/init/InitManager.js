import { ExhaustSystem } from "./ExhaustSystem.js";
import { PhysicsManager } from "./PhysicsManager.js";
import { SpriteManager } from "./SpriteManager.js";

export class InitManager {
  constructor() {
    this.spriteManager = new SpriteManager();
    this.physicsManager = new PhysicsManager();
    this.exhaustSystem = new ExhaustSystem();

    // entities.forEach((entity) => {
    //   this.initEntity(entity);
    // });
  }

  initEntity(entity) {
    if (!entity.hasComponent("SpriteComponent")) return;
    this.spriteManager.createSprite(entity);
    this.physicsManager.addDynamicBody(entity);
    this.physicsManager.addStaticBody(entity);
    this.exhaustSystem.createExhaust(entity);
    const spriteComponent = entity.getComponent("SpriteComponent");
    if (!spriteComponent.enabled) spriteComponent.sprite.kill();
    // console.log(entity);
  }
}
