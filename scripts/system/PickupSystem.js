import { addResource } from "./ResourceSystem.js";

export class PickupSystem {
  constructor(inventorySystem, audioSystem, hud) {
    this.audioSystem = audioSystem;
    this.inventorySystem = inventorySystem;
    this.hud = hud;
  }

  collectPickup(data) {
    const pickup = data.trigger.getComponent("PickupComponent");
    const resourceComponent = data.activator.getComponent("ResourceComponent");
    console.log(pickup);

    switch (pickup.category) {
      case "ammo":
        this.collectResource(pickup, resourceComponent, data);
        break;
      case "item":
        this.collectInventoryItem(data.activator, pickup);
        break;
      default:
        break;
    }
  }

  collectInventoryItem(entity, pickup) {
    if (!this.inventorySystem) return;
    this.inventorySystem.add(entity, pickup.itemName);
    if (!entity.hasComponent("HudComponent")) return;
    this.inventorySystem.syncHud(entity);
    this.hud.notify(`Acquired ${pickup.itemName}`, 600);
    if (this.audioSystem) {
      this.audioSystem.play("pickup");
    }
  }

  collectResource(pickup, resourceComponent, data) {
    if (!resourceComponent) return;
    addResource(pickup, resourceComponent);
    if (!this.inventorySystem || !data.activator.hasComponent("HudComponent"))
      return;
    this.inventorySystem.syncHud(data.activator);
    this.hud.notify(`+ ${pickup.amount} ${pickup.type}`, 600);
    if (this.audioSystem) {
      this.audioSystem.play("pickup");
    }
    // console.log(data);
  }
}
