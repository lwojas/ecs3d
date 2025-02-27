export class MovementSystem {
  constructor(entities) {
    this.entities = entities;
  }

  update() {
    this.entities.forEach((entity) => {
      if (entity.hasComponent("Position") && entity.hasComponent("Velocity")) {
        let position = entity.getComponent("Position");
        let velocity = entity.getComponent("Velocity");

        position.x += velocity.vx;
        position.y += velocity.vy;
      }
    });
  }
}
