import { attachRectangleBodies } from "../utils/generatePhysicsBodies.js";
import { decomposeWhiteToRectangles } from "../utils/tracePhysics.js";

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
      !entity.hasComponent("SpriteComponent") ||
      !entity.hasComponent("PhysicsStaticComponent")
    )
      return;
    const staticComp = entity.getComponent("PhysicsStaticComponent");

    let spriteComp = entity.getComponent("SpriteComponent");
    if (staticComp.complex) {
      const img = game.cache.getImage(spriteComp.spriteKey);

      // Draw to canvas to read alpha
      const temp = document.createElement("canvas");
      temp.width = img.width;
      temp.height = img.height;
      const ctx = temp.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      let rectangles = decomposeWhiteToRectangles(imageData);
      staticComp.collisionObject = attachRectangleBodies(
        spriteComp.sprite,
        rectangles,
        true
      );
    } else {
      game.physics.arcade.enable(spriteComp.sprite);
      spriteComp.sprite.body.immovable = true;
      staticComp.collisionObject = spriteComp.sprite;
    }
    // console.log(sprite);
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
