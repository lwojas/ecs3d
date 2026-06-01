export function drawDebugLine(
  ctx,
  x1,
  y1,
  x2,
  y2,
  color = "#0daff4ff",
  width = 4
) {
  //   console.log("Drawing debug line");
  ctx.save();
  //   ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(x1 - game.camera.x, y1 - game.camera.y);
  ctx.lineTo(x2 - game.camera.x, y2 - game.camera.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}
