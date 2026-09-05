import { Particle } from "./Particle.js";

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function resolveValue(value, fallback = 0) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "number") {
    return value;
  }

  return randomRange(value.min, value.max);
}

function resolveScale(scale) {
  if (scale === undefined || scale === null) {
    return {
      x: 1,
      y: 1,
    };
  }

  if (typeof scale === "number") {
    return {
      x: scale,
      y: scale,
    };
  }

  return {
    x: scale.x ?? 1,
    y: scale.y ?? 1,
  };
}

export class ParticleSystem {
  constructor(config = {}, renderer) {
    this.maxParticles = config.maxParticles ?? 256;

    this.config = config.particles ?? {};

    this.particles = new Array(this.maxParticles);

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i] = new Particle();
    }

    /*
     * Reused every frame.
     *
     * This is important because camera.sprites is disposable
     * renderer input and we don't want to allocate a new array
     * every frame either.
     */
    this.spriteBuffer = renderer.sprites;

    /*
     * Optional environment collision callback.
     *
     * Leave null until particle/environment interaction is needed.
     */
    this.collisionResolver = null;
  }

  emit(type, position, overrides = {}) {
    // console.log(
    //   "Emitting particle of type:",
    //   type,
    //   "at position:",
    //   position,
    //   "with overrides:",
    //   overrides,
    // );
    const particleConfig = this.config[type];

    if (!particleConfig) {
      return null;
    }

    const particle = this.getInactiveParticle();

    if (!particle) {
      return null;
    }

    const velocity = particleConfig.velocity ?? {};

    const scale = resolveScale(overrides.scale ?? particleConfig.scale);

    const lifetime = resolveValue(
      overrides.lifetime ?? particleConfig.lifetime,
      1,
    );

    particle.reset({
      x: position.x,
      y: position.y,
      z: position.z,

      velocityX: resolveValue(overrides.velocityX ?? velocity.x),

      velocityY: resolveValue(overrides.velocityY ?? velocity.y),

      velocityZ: resolveValue(overrides.velocityZ ?? velocity.z),

      gravity: overrides.gravity ?? particleConfig.gravity ?? 1,

      life: lifetime,

      texture: overrides.texture ?? particleConfig.texture,

      width: overrides.width ?? particleConfig.width ?? 1,

      height: overrides.height ?? particleConfig.height ?? 1,

      scaleX: scale.x,
      scaleY: scale.y,
    });

    // console.log(particle);

    return particle;
  }

  emitBurst(type, position, count = 1, overrides = {}) {
    let emitted = 0;

    for (let i = 0; i < count; i++) {
      const particle = this.emit(type, position, overrides);

      if (!particle) {
        break;
      }

      emitted++;

      //   this.spriteBuffer.push(particle);
    }

    return emitted;
  }

  update(delta) {
    for (const particle of this.particles) {
      if (!particle.active) {
        continue;
      }

      particle.update(delta);

      if (!particle.active) {
        continue;
      }

      this.spriteBuffer.push({
        x: particle.x,
        y: particle.y,
        z: particle.z,

        texture: particle.texture,

        width: particle.width,
        height: particle.height,

        scale: {
          x: particle.scaleX,
          y: particle.scaleY,
        },
      });

      if (this.collisionResolver) {
        this.collisionResolver(particle, delta);
      }
    }
  }

  getInactiveParticle() {
    for (const particle of this.particles) {
      if (!particle.active) {
        return particle;
      }
    }

    return null;
  }

  setCollisionResolver(resolver) {
    this.collisionResolver = resolver;
  }
}
