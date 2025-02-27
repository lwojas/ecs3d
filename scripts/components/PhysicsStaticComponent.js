export class PhysicsStaticComponent {
  constructor(entity) {
    if (entity.hasComponent("SpriteComponent")) {
      let sprite = entity.getComponent("SpriteComponent").sprite;
      // console.log(sprite);
      game.physics.arcade.enable(sprite);
      sprite.body.immovable = true;
    }
  }
}
