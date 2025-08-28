export function followEntity(entity) {
  if (entity.hasComponent("CameraFollowComponent"))
    game.camera.follow(entity.getComponent("SpriteComponent").sprite);
}
