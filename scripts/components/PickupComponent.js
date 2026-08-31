export class PickupComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.category = data.pickupType || "ammo";
    this.type = data.type || "plasma";
    this.amount = data.amount || 150;
    this.useNow = true;
  }
}
