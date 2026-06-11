import { explosionList } from "./utils/explosions.js";

export class ExplosionSystem {
  constructor() {
    this.explosions = explosionList;
    this.emitters = [];
    this.explosionGroup = game.add.group();
    for (let i = 0; i < 10; i++) {
      this.createExplosion();
    }
  }
  createExplosion() {
    const emitter = game.add.emitter(0, 0, 50);

    emitter.makeParticles("pixelWhite");

    // Random velocity in all directions
    emitter.setXSpeed(-200, 200);
    emitter.setYSpeed(-200, 200);

    // Optional effects
    emitter.gravity = 0;
    emitter.setAlpha(1, 0, 1000);
    emitter.setScale(4, 0, 4, 0, 1000);
    // emitter.kill();
    this.emitters.push(emitter);
    this.explosionGroup.add(emitter);
  }

  getEmitter() {
    for (let emitter of this.emitters) {
      if (!emitter.on) {
        return emitter;
      }
    }
  }

  startExplosion(x, y) {
    const emitter = this.getEmitter();
    if (emitter) {
      emitter.x = x;
      emitter.y = y;
      // explode=true, lifespan=1000ms, frequency ignored, quantity=30
      emitter.start(true, 1000, null, 30);
    }
  }

  update(delta) {
    this.explosions.forEach((explosion, index) => {
      console.log(
        "[ExplosionSystem] Processing explosion at ",
        explosion.x,
        explosion.y,
      );
      this.startExplosion(explosion.x, explosion.y);
      this.explosions.splice(index, 1);
    });
  }
}
