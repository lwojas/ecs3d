export class WeaponComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.weaponSprite;
    this.weaponType = data.weaponType;
    this.spriteKey = data.spriteKey;
    this.weaponClass = data.weaponClass;
  }
}
