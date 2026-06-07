import { System } from "./System.js";

export class KillSystem extends System {
  constructor() {
    super();
    this.entities = this.entityManager.registerSystem(this, [
      "HealthComponent",
    ]);
  }

  update() {
    this.entities.forEach((entity) => {
      const healthComponent = entity.getComponent("HealthComponent");
      if (healthComponent.health <= 0) {
        this.entityManager.initManager.killEntity(entity);
        // this.entityManager.removeEntity(entity);
      }
    });
  }
}
