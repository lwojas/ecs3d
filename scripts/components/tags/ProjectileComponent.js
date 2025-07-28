export class ProjectileComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.name = data.name;
    this.spriteKey = data.spriteKey;
    this.weaponType = data.weaponType;
  }
}
