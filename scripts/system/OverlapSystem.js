import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";

export class OverlapSystem extends System {
  constructor(entityComponents, targetComponents) {
    super();
    this.entities = this.entityManager.registerSystem(this, entityComponents);
    const entityManager = this.entityManager;
    this.targetSystem = {};
    this.targetSystem.entities = entityManager.registerSystem(
      this.targetSystem,
      targetComponents
    );
    ServiceLocator.register("game", "OverlapSystem", this);
  }

  testOverlap(object1, object2) {
    console.log(`--Overlap event - object1 - ${object1.parentEntity.id}`);
  }

  update() {
    this.overlap = game.physics.arcade.overlap(
      this.actors,
      this.targetSystem.actors,
      this.testOverlap,
      null,
      this
    );
  }
}
