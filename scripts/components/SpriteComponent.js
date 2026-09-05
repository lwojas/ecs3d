export class SpriteComponent {
  static editor = {
    fields: {
      spriteKey: { type: "string" },
      enabled: { type: "boolean" },
      x: { type: "number" },
      y: { type: "number" },
      z: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
      scale: { type: "number" },
      texture: { type: "string" },
      billboard: { type: "boolean" },
      angle: { type: "number" },
      animationState: { type: "string" },
    },
  };

  constructor(entity, data) {
    this.spriteKey = data.spriteKey || "default";
    this.enabled = data.enabled ?? true;
    // this.isAlive = data.isAlive || true;
    this.entity = entity;
    this.x = data.x ?? 28;
    this.y = data.y ?? 12;
    this.z = data.z ?? 0;
    this.width = data.width ?? 1;
    this.height = data.height ?? 1;
    this.scale = data.scale ?? 16;
    this.texture = data.texture || "Cobra";
    this.billboard = data.billboard ?? true;
    this.angle = data.angle ?? 0;

    // Animation intent only (idle | walking | attacking, ...) -- callers
    // like AISystem set this, SpriteSystem/the renderer decide what to do
    // with it. Not a frame index/timeline yet; add one when a caller
    // actually needs it.
    this.animationState = data.animationState || "idle";
  }
}
