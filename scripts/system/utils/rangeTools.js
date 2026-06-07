export function isWithinRange(spriteA, spriteB, range) {
  var dx = spriteA.x - spriteB.x;
  var dy = spriteA.y - spriteB.y;

  return dx * dx + dy * dy <= range * range;
}
