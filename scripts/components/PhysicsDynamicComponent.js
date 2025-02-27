export class PhysicsDynamicComponent {
  constructor(entity, data) {
    if (entity.hasComponent("SpriteComponent")) {
      let sprite = entity.getComponent("SpriteComponent").sprite;
      // console.log(sprite);
      game.physics.arcade.enable(sprite);
      sprite.body.collideWorldBounds = true;
      sprite.anchor.setTo(0.5, 0.5);
    }

    // this.Avatar.body.setSize(bodySizeW, bodySizeH, bodyOffsetX, bodyOffsetY);
    // this.Avatar.body.drag.set(0.2);
    // this.Avatar.body.bounce.y = physBounceY;
    // this.Avatar.body.gravity.y = physGravityY;
    // this.Avatar.body.collideWorldBounds = collideWithWorld;
  }
}
