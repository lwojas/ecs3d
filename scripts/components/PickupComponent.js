export class PickupComponent {
  static editor = {
    fields: {
      category: { type: "string" },
      itemName: { type: "string" },
      amount: { type: "number" },
      useNow: { type: "boolean" },
    },
  };
  constructor(entity, data) {
    this.entity = entity;
    this.category = data.pickupType || "ammo";
    this.itemName = data.itemName || "plasma";
    this.amount = data.amount || 150;
    this.useNow = true;
  }
}
