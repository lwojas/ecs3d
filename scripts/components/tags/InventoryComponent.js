export class InventoryComponent {
  constructor() {
    this.ammo = {};
    this.items = new Map();
  }
  addItem(entity) {
    this.items.set(entity, entity);
  }
  removeItem(entity) {
    this.items.delete(entity);
  }
}
