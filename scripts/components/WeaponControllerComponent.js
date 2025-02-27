import { TrackerComponent } from "./tags/TrackerComponent.js";

export class WeaponControllerComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.currentWeapon;
  }
  switchWeapon(entity) {
    if (this.currentWeapon) {
      this.currentWeapon.getComponent("WeaponComponent").weaponSprite.kill();
      this.currentWeapon.removeComponent("TrackerComponent");
    }
    this.currentWeapon = entity;
    console.log(entity, this.entity);
    entity.getComponent("WeaponComponent").weaponSprite.reset(0, 0);
    entity.addComponent(
      new TrackerComponent(
        entity,
        entity.getComponent("WeaponComponent").weaponSprite,
        this.entity.getComponent("SpriteComponent").sprite
      )
    );
  }
}
