export class BloodSplat {
  constructor(particleSystem, config = {}) {
    this.particleSystem = particleSystem;

    this.particleType = config.particleType ?? "bloodDrop";

    this.count = config.count ?? 64;
  }

  spawn(position, options = {}) {
    const count = options.count ?? this.count;
    // console.log("BloodSplat spawn", position, count);
    this.particleSystem.emitBurst(this.particleType, position, count);
  }
}

export class PortalParticles {
  constructor(particleSystem, config = {}) {
    this.particleSystem = particleSystem;

    this.particleType = config.particleType ?? "portal";

    this.count = config.count ?? 64;
  }

  spawn(position, options = {}) {
    const count = options.count ?? this.count;
    console.log("portal spawn", position, count);
    this.particleSystem.emitBurst(this.particleType, position, count);
  }
}
