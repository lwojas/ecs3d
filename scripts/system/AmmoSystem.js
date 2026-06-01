import { ServiceLocator } from "../services/ServiceLocator.js";

export class AmmoSystem {
  constructor(entities) {
    entities.forEach((entity) => {
      this.setAmmo(entity);
    });
    ServiceLocator.resolve("game", "EventSystem").on(
      "G_ADD_AMMO",
      this.increaseAmmo
    );
    // .ammoTypes.forEach((ammo) => {
    //     this.ammoInventory.set(ammo.type, ammo.amount);
    //   });
  }

  setAmmo(entity) {
    if (!entity.hasComponent("AmmoComponent")) return;
    let ammoComponent = entity.getComponent("AmmoComponent");
    ammoComponent.ammoTypes.forEach((ammo) => {
      ammoComponent.ammoInventory.set(ammo.type, ammo.amount);
      ammoComponent.ammoProps.set(ammo.type, ammo.props);
    });
  }

  increaseAmmo(sourceEntity, targetEntity) {
    console.log(sourceEntity.components);
    if (!sourceEntity.hasComponent("AmmoItemComponent")) return;
    let ammoItem = sourceEntity.getComponent("AmmoItemComponent");
    let ammoInventory =
      targetEntity.getComponent("AmmoComponent").ammoInventory;
    if (ammoInventory.has(ammoItem.weaponType)) {
      let currentAmmo = ammoInventory.get(ammoItem.weaponType);
      currentAmmo += ammoItem.amount;
      ammoInventory.set(ammoItem.weaponType, currentAmmo);
    }
  }
}
