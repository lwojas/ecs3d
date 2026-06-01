export function getBoundingRadius(width, height) {
  const boundingRadius = Math.round(
    Math.sqrt((width / 2) ** 2 + (height / 2) ** 2)
  );
  console.log("Bounding radius set to: ", boundingRadius);
  return boundingRadius;
}
