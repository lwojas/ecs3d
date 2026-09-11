export class Projectile {
  constructor(type, data) {
    this.type = type;
    // this.spriteRenderArray = renderer.sprites;

    // Renderer state
    this.x = 0;
    this.y = 0;
    this.z = 0;

    this.damage = data.damage || 5;

    // Hit-reaction inputs, read by CombatSystem.applyHitReaction --
    // separate from damage so a weapon can hit hard without staggering,
    // or vice versa. Default to 0 (no reaction) for anything that
    // doesn't define them.
    this.staggerPower = data.staggerPower ?? 0;
    this.knockback = data.knockback ?? 0;
    this.width = data.width;
    this.height = data.height;
    this.scale = data.scale;
    this.texture = data.texture;
    this.isLightSource = data.lighting || false;

    this.isLightSource = data.lighting;

    // Lighting
    if (this.isLightSource) {
      this.radius = 20;
      this.intensity = 1.5;
      this.tint = { r: 255, g: 180, b: 120 };
    }

    // Collision geometry
    this.collisionRadius = data.collisionRadius ?? 8;
    this.collisionHeight = data.collisionHeight ?? 8;
    this.collisionOffsetZ = data.collisionOffsetZ ?? 0;

    // Movement state
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    // Lifecycle
    this.age = 0;
    this.lifetime = data.lifetime;

    this.active = false;
  }

  setOwner(component) {
    this.entity = component.entity;
  }

  fire(x, y, z, vx, vy, vz) {
    this.x = x;
    this.y = y;
    this.z = z;

    this.vx = vx;
    this.vy = vy;
    this.vz = vz;

    this.age = 0;
    this.active = true;
  }

  fireAtTarget(x, y, z, targetX, targetY, targetZ, speed) {
    const dx = targetX - x;
    const dy = targetY - y;
    const dz = targetZ - z;

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance === 0) {
      return;
    }

    const directionX = dx / distance;
    const directionY = dy / distance;
    const directionZ = dz / distance;

    this.fire(
      x,
      y,
      z,
      directionX * speed,
      directionY * speed,
      directionZ * speed,
    );
  }

  // update(delta) {
  //   if (!this.active) {
  //     return;
  //   }

  //   this.age += delta;

  //   if (this.age >= this.lifetime) {
  //     this.active = false;
  //     return;
  //   }

  //   this.x += this.vx * delta;
  //   this.y += this.vy * delta;
  //   this.z += this.vz * delta;

  //   // this.spriteRenderArray.push(this);
  //   // if (this.isLightSource) this.lightRenderArray.push(this);
  // }

  deactivate() {
    this.active = false;
  }
}
