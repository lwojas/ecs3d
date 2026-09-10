// Fire-cooldown bookkeeping only. "What's equipped" lives on
// InventoryComponent now -- this component's continued presence on an
// entity is still the "can this entity use items at all" composition
// gate AISystem checks, separate from which item is equipped.
export class ItemComponent {
  static editor = {
    fields: {
      fireOffsetZ: { type: "number" },
    },
  };

  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;
    this.nextFireTime = 0;

    // Height (relative to the entity's base/standing z) that projectiles
    // spawn from when this entity fires at a target -- see
    // ItemSystem.fireToTarget. Defaults to the old hardcoded offset so
    // entities that don't set this keep firing from the same height.
    this.fireOffsetZ = data.fireOffsetZ ?? 3;
  }
}
