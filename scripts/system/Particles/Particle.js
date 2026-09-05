export class Particle {
  constructor() {
    this.active = false;

    this.x = 0;
    this.y = 0;
    this.z = 0;

    this.velocityX = 0;
    this.velocityY = 0;
    this.velocityZ = 0;

    this.gravity = 0;

    this.life = 0;
    this.maxLife = 0;

    this.texture = null;

    this.width = 1;
    this.height = 1;

    this.scaleX = 1;
    this.scaleY = 1;
  }

  reset(data) {
    this.active = true;

    this.x = data.x;
    this.y = data.y;
    this.z = data.z;

    this.velocityX = data.velocityX;
    this.velocityY = data.velocityY;
    this.velocityZ = data.velocityZ;

    this.gravity = data.gravity;

    this.life = data.life;
    this.maxLife = data.life;

    this.texture = data.texture;

    this.width = data.width;
    this.height = data.height;

    this.scaleX = data.scaleX;
    this.scaleY = data.scaleY;
  }

  update(delta) {
    this.velocityZ -= this.gravity * delta;

    this.x += this.velocityX * delta;
    this.y += this.velocityY * delta;
    this.z += this.velocityZ * delta;

    this.life -= delta;

    if (this.life <= 0) {
      this.active = false;
    }
  }

  deactivate() {
    this.active = false;
  }
}
