import { itemData } from "./ItemSystem.js/itemData.js";

export class InteractionSystem {
  constructor(hud, gameplayManager) {
    this.state = "GAME_PLAY";
    this.itemSystem = null;
    this.hud = hud;
    this.itemData = itemData;
    this.gameplayManager = gameplayManager;
  }

  playerInteraction(boundTarget, userId) {
    const itemName = this.resolveEquippedItem(boundTarget);
    if (!itemName) return;
    this.itemSystem.useItem(itemName, userId, boundTarget);
  }

  // Reads the ECS InventoryComponent on the player's own entity, not
  // GameplayManager's persistent session state -- InventoryComponent is
  // the authoritative "what's currently equipped" for gameplay; the
  // persistent copy only matters at session/map start (see
  // GameSession.js).
  resolveEquippedItem(boundTarget) {
    return boundTarget.entity.getComponent("InventoryComponent")?.equipped ?? null;
  }

  setItemSystem(system) {
    this.itemSystem = system;
  }

  updateMovement(target, isMoving) {
    this.hud.items.setBob(isMoving);
  }

  updateInteraction(action, boundTarget, userId) {
    if (this.state === "GAME_PLAY") {
      if (!this.itemSystem) return;
      this.playerInteraction(boundTarget, userId);
    }
  }
}
