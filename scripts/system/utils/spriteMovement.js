export function moveSpriteByRotation(source, target, maxSpeed = 75) {
  var angle = game.physics.arcade.angleBetween(source, target);
  source.rotation = angle;
  game.physics.arcade.accelerationFromRotation(
    source.rotation,
    maxSpeed,
    source.body.acceleration,
  );
  source.body.angularVelocity = 0;
}
