export function subdividePolygon(polygon, maxEdgeLength = 64) {
  const newPoints = [];
  const pts = polygon.points;
  console.log("Original points size: ", pts.length);

  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];

    newPoints.push(p1.clone());

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);

    if (dist > maxEdgeLength) {
      const steps = Math.ceil(dist / maxEdgeLength);
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        newPoints.push(new Phaser.Point(p1.x + dx * t, p1.y + dy * t));
      }
    }
  }
  console.log("After subdivision: ", newPoints.length);

  return new Phaser.Polygon(newPoints);
}
