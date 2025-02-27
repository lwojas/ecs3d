export class WeaponComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.weaponSprite = game.add.sprite(100, 100, data.weaponSprite);
    this.weaponSprite.anchor.setTo(0.5, 0.5);
    this.weaponSprite.scale.setTo(2, 2);
  }
}
