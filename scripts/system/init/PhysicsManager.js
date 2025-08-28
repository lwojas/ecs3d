export class PhysicsManager {
  constructor() {}

  addDynamicBody(entity) {
    if (
      entity.hasComponent("SpriteComponent") &&
      entity.hasComponent("PhysicsDynamicComponent")
    ) {
      let sprite = entity.getComponent("SpriteComponent").sprite;
      // console.log(entity.getComponent("SpriteComponent").sprite);
      game.physics.arcade.enable(sprite);
      sprite.body.collideWorldBounds = true;
      sprite.anchor.setTo(0.5, 0.5);
      // If there is a movement component lets adjust a few more properties on the body
      if (!entity.hasComponent("MovementComponent")) return;
      const movement = entity.getComponent("MovementComponent");
      sprite.body.drag.set(movement.drag);
      sprite.body.maxVelocity.set(movement.maxVelocity);
    }
  }

  addStaticBody(entity) {
    if (
      entity.hasComponent("SpriteComponent") &&
      entity.hasComponent("PhysicsStaticComponent")
    ) {
      let sprite = entity.getComponent("SpriteComponent").sprite;
      // console.log(sprite);
      game.physics.arcade.enable(sprite);
      sprite.body.immovable = true;
    }
  }

  addShipPhysics(entity) {
    if (
      entity.hasComponent("SpriteComponent") &&
      entity.hasComponent("ShipPhysicsComponent")
    ) {
      let shipComponent = entity.getComponent("ShipPhysicsComponent");
      let sprite = entity.getComponent("SpriteComponent").sprite;
      sprite.body.drag.set(shipComponent.drag);
      // sprite.body.angularDrag = 20;
      sprite.body.maxAngular = shipComponent.maxAngular;
      sprite.body.maxVelocity.setTo(
        shipComponent.maxVelocity || 200,
        shipComponent.maxVelocity || 200
      );
    }
  }
}
