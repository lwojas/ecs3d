// Fire-cooldown bookkeeping only. "What's equipped" lives on
// InventoryComponent now -- this component's continued presence on an
// entity is still the "can this entity use items at all" composition
// gate AISystem checks, separate from which item is equipped.
export class ItemComponent {
  static editor = {
    fields: {},
  };

  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;
    this.nextFireTime = 0;
  }
}
