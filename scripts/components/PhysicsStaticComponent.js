export class PhysicsStaticComponent {
  constructor(entity) {
    this.entity = entity;
    this.complex = true;
    this.collisionObject;
    // if (entity.hasComponent("SpriteComponent")) {
    //   let sprite = entity.getComponent("SpriteComponent").sprite;
    //   // console.log(sprite);
    //   game.physics.arcade.enable(sprite);
    //   sprite.body.immovable = true;
  }
}
