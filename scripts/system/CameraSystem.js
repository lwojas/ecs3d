export class CameraSystem {
  constructor(entities) {
    entities.forEach((entity) => {
      this.followEntity(entity);
    });
  }

  followEntity(entity) {
    if (entity.hasComponent("CameraFollowComponent"))
      game.camera.follow(entity.getComponent("SpriteComponent").sprite);
  }
}
