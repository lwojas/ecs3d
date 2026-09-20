export class PickupComponent {
  static editor = {
    fields: {
      category: { type: "string" },
      itemName: { type: "string" },
      amount: { type: "number" },
      useNow: { type: "boolean" },
      respawnTime: { type: "number" },
      once: { type: "boolean" },
    },
  };
  constructor(entity, data) {
    this.entity = entity;
    this.category = data.category || "ammo";
    this.itemName = data.itemName || "plasma";
    this.amount = data.amount || 150;
    this.useNow = true;
    this.once = data.once ?? false;
    this.respawnTime = data.respawnTime ?? 2000;
  }
}
