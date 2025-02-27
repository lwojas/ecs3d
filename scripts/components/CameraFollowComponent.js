export class CameraFollowComponent {
  constructor(entity) {
    this.entity = entity;
    this.followEntity(entity);
  }

  followEntity(entity) {
    let spriteToFollow = entity.getComponent("SpriteComponent").sprite;
    game.camera.follow(spriteToFollow);
  }
}
