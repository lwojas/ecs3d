export function castShadows(lightX, lightY, shadowComponents) {
  let ctx = this.bitmapDataMask.context;

  shadowComponents.forEach((comp) => {
    comp.updateWorldPolygon();

    let verts = comp.worldPolygon.points;

    verts.forEach((v) => {
      // Ray direction
      let dx = v.x - lightX;
      let dy = v.y - lightY;
      let len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;

      // Extend ray outward
      let shadowX = v.x + dx * 1000;
      let shadowY = v.y + dy * 1000;

      // Draw polygon (triangle light → vertex → extended ray)
      ctx.beginPath();
      ctx.moveTo(v.x - game.camera.x, v.y - game.camera.y);
      ctx.lineTo(shadowX - game.camera.x, shadowY - game.camera.y);
      ctx.lineTo(lightX - game.camera.x, lightY - game.camera.y);
      ctx.closePath();

      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fill();
    });
  });
}
