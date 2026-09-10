import { COLLISION } from "../tools/collisionLayers.js";

export class CollisionComponent {
  static editor = {
    fields: {
      radius: { type: "number" },
      height: { type: "number" },
      offsetZ: { type: "number" },
      enabled: { type: "boolean" },
      layer: { type: "string" },
      mask: { type: "array" },
    },
  };

  constructor(entity, data = {}) {
    this.entity = entity;

    // Horizontal collision radius in world units.
    this.collisionRadius = data.radius || 2;
    this.collisionHeight = data.height || 4;
    this.collisionOffsetZ = data.offsetZ ?? 0;

    this.enabled = data.enabled ?? true;
    this.layer = COLLISION[data.layer] ?? COLLISION.TRIGGER;
    this.mask = data.mask
      ? data.mask.reduce((mask, type) => mask | COLLISION[type], 0)
      : COLLISION.PLAYER;
    // console.log(
    //   "CollisionComponent created with layer:",
    //   this.layer,
    //   "and mask:",
    //   this.mask,
    // );
  }
}
