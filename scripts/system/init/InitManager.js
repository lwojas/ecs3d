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
    this.spriteManager.createSprite(entity);
    this.physicsManager.addDynamicBody(entity);
    this.physicsManager.addStaticBody(entity);
    this.exhaustSystem.createExhaust(entity);
    // console.log(entity);
  }
}
