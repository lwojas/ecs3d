export class AmmoComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.ammoInventory = new Map();
    this.ammoProps = new Map();
    this.ammoTypes = data.ammoTypes;
  }
}
