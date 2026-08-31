export class CollisionComponent {
  constructor(entity, data = {}) {
    this.entity = entity;

    // Horizontal collision radius in world units.
    this.collisionRadius = data.radius || 2;
    this.collisionHeight = data.height || 8;
    this.collisionOffsetZ = data.offsetZ ?? 2;

    this.enabled = data.enabled || true;
  }
}
