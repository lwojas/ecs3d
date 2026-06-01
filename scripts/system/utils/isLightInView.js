// isLightInView.js
// Checks if a light volume overlaps the current camera view
// light: { position: {x,y}, radius: number, coneAngle?: number, coneLength?: number }
// extraMargin: number (optional) expands/shrinks the bounding check

export function isLightInView(light, extraMargin = 0) {
  const camera = game.camera;
  const { x, y } = light.position;
  let range = light.radius || 0;

  // If it's a cone light, we can treat coneLength as effective radius

  // Define a simple bounding box for the light's influence
  const left = x - range - extraMargin;
  const right = x + range + extraMargin;
  const top = y - range - extraMargin;
  const bottom = y + range + extraMargin;

  // Camera world view rectangle
  const camLeft = camera.x;
  const camRight = camera.x + camera.width;
  const camTop = camera.y;
  const camBottom = camera.y + camera.height;

  // Basic AABB overlap test
  const overlap =
    left < camRight && right > camLeft && top < camBottom && bottom > camTop;

  return overlap;
}
