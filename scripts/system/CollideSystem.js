import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";

export class CollideSystem extends System {
  constructor() {
    super();
    this.entities = this.entityManager.registerSystem(this, [
      "CollideComponent",
    ]);
    this.staticSystem = {};
    this.staticSystem.entities = this.entityManager.registerSystem(
      this.staticSystem,
      ["PhysicsStaticComponent"]
    );

    this.staticCollisionSprites = this.staticSystem.entities.map((entity) => {
      return [...entity.getComponent("PhysicsStaticComponent").collisionObject];
    });
    console.log(this.staticCollisionSprites);
    // const entityManager = this.entityManager;
    // this.targetSystem = {};
    // this.targetSystem.entities = entityManager.registerSystem(
    //   this.targetSystem,
    //   targetComponents
    // );
    ServiceLocator.register("game", "CollideSystem", this);
  }

  testCollide(object1, object2) {
    // console.log(`--Overlap event - object1 - ${object1.parentEntity.id}`);
  }

  update() {
    this.collide = game.physics.arcade.collide(
      this.actors,
      [...this.staticCollisionSprites],
      this.testCollide,
      null,
      this
    );
  }
}
