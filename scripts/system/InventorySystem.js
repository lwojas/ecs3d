import { ServiceLocator } from "../services/ServiceLocator.js";
import { killSprite, disableSprite } from "./utils/spriteTools.js";
import { EntityStore } from "../services/EntityStore.js";
import { disableTrigger } from "./utils/triggerTools.js";

export class InventorySystem {
  constructor() {
    ServiceLocator.resolve("game", "EventSystem").on(
      "G_INVENTORY_ADD_ITEM",
      this.addItem
    );
  }

  addItem(itemEntity, targetEntity) {
    if (!targetEntity.hasComponent("InventoryComponent")) return;
    const inventory = targetEntity.getComponent("InventoryComponent").inventory;
    disableTrigger(itemEntity);
    // Kill the main sprite
    killSprite(itemEntity);
    disableSprite(itemEntity);
    inventory.set(itemEntity, itemEntity);
    // If item is a weapon equip it
    if (itemEntity.hasComponent("WeaponComponent")) {
      ServiceLocator.resolve("game", "EventSystem").emit(
        "G_EQUIP_WEAPON",
        itemEntity,
        targetEntity
      );
    }
    console.log("--Item successfully added");
  }

  removeItem(itemEntity, targetEntity) {
    if (!targetEntity.hasComponent("InventoryComponent")) return;
    const inventory = targetEntity.getComponent("InventoryComponent").inventory;
    inventory.delete(itemEntity);
  }

  shutdown(entities) {
    entities.forEach((entity) => {
      if (!entity.hasComponent("InventoryComponent")) return;
      let inventoryList = [];
      entity
        .getComponent("InventoryComponent")
        .inventory.forEach((inventory) => {
          //   console.log(inventory);
          inventoryList.push({
            id: inventory.id,
            components: inventory.snapshot,
          });
        });
      EntityStore.inventories.set(entity.id, inventoryList);
    });
    // console.log(EntityStore.inventories);
  }
}
