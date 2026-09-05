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
