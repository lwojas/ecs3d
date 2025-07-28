export function killSprite(entity) {
  if (!entity.hasComponent("SpriteComponent")) return;
  console.log("Killing sprite");
  const sprite = entity.getComponent("SpriteComponent").sprite;
  const position = entity.getComponent("Position");
  position.x = sprite.world.x;
  position.y = sprite.world.y;
  sprite.kill();
}

export function reviveSprite(entity) {
  if (!entity.hasComponent("SpriteComponent")) return;
  const sprite = entity.getComponent("SpriteComponent");
  const position = entity.getComponent("Position");
  sprite.reset(position.x, position.y);
}

export function disableSprite(entity) {
  if (!entity.hasComponent("SpriteComponent")) return;
  const spriteComponent = entity.getComponent("SpriteComponent");
  spriteComponent.enabled = false;
  entity.snapshot["SpriteComponent"].enabled = false;
}

export function enableSprite(entity) {
  if (!entity.hasComponent("SpriteComponent")) return;
  const spriteComponent = entity.getComponent("SpriteComponent");
  spriteComponent.enabled = true;
  entity.snapshot["SpriteComponent"].enabled = true;
}
