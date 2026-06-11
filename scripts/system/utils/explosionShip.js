// Create a 1x1 white pixel once during preload/create
export function createExplosion() {
  // Create emitter
  const emitter = game.add.emitter(0, 0, 50);

  emitter.makeParticles("pixelWhite");

  // Random velocity in all directions
  emitter.setXSpeed(-200, 200);
  emitter.setYSpeed(-200, 200);

  // Optional effects
  emitter.gravity = 0;
  emitter.setAlpha(1, 0, 1000);
  emitter.setScale(4, 0, 4, 0, 1000);

  // Trigger explosion
  function explode(x, y) {
    emitter.x = x;
    emitter.y = y;

    // explode=true, lifespan=1000ms, frequency ignored, quantity=30
    emitter.start(true, 1000, null, 30);
  }
  explode(100, 100); // Example usage: explode at (100, 100)
}
