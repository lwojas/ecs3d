export class ShipPhysicsComponent {
  constructor(entity, data) {
    if (entity.hasComponent("SpriteComponent")) {
      let sprite = entity.getComponent("SpriteComponent").sprite;
      sprite.body.drag.set(data.drag);
      // sprite.body.angularDrag = 20;
      sprite.body.maxAngular = data.maxAngular;
      sprite.body.maxVelocity.setTo(200, 200);
    }
  }
}
