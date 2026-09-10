import { itemData } from "./ItemSystem/itemData.js";
import { System } from "./System.js";

// Smallest useful interface over InventoryComponent -- add/remove/has/
// equip, plus getSnapshot() for the ECS->session save direction (see
// GameSession.js). No update() -- nothing here needs per-frame
// processing. Registers via entityManager.registerSystem() for
// consistency with every other System subclass, but (like
// CombatSystem.getHealth()) every real method operates on a passed-in
// entity via entity.getComponent(), not the cached list.
export class InventorySystem extends System {
  constructor(hud) {
    super();
    this.entities = this.entityManager.registerSystem(this, [
      "InventoryComponent",
    ]);
    this.hud = null;
  }

  registerHud(hud) {
    this.hud = hud;
  }

  getInventory(entity) {
    return entity.getComponent("InventoryComponent");
  }

  has(entity, itemId) {
    return this.getInventory(entity)?.items.includes(itemId) ?? false;
  }

  add(entity, itemId) {
    const inventory = this.getInventory(entity);
    if (!inventory) return false;
    if (!inventory.items.includes(itemId)) inventory.items.push(itemId);
    return true;
  }

  // Clears .equipped if the removed item was the equipped one -- an
  // entity should never end up "equipped" on something it no longer owns.
  remove(entity, itemId) {
    const inventory = this.getInventory(entity);
    if (!inventory) return false;

    const index = inventory.items.indexOf(itemId);
    if (index === -1) return false;

    inventory.items.splice(index, 1);
    if (inventory.equipped === itemId) inventory.equipped = null;
    return true;
  }

  // No-ops (returns false) if the item isn't owned -- equipping
  // something you don't have is never valid.
  equip(entity, itemId) {
    const inventory = this.getInventory(entity);
    if (!inventory || !inventory.items.includes(itemId)) return false;
    inventory.equipped = itemId;
    this.syncHud(entity, itemId);
    return true;
  }

  syncHud(entity) {
    if (this.hud) {
      const itemId = this.getInventory(entity).equipped;
      this.hud.equip(itemId);
      // Not every entity carries a ResourceComponent (e.g. bots don't
      // today) -- equipping something must never throw just because
      // there's no ammo to display for it.
      const resources = entity.getComponent("ResourceComponent")?.resources;
      const resource = resources?.[itemData[itemId]?.projectile];
      if (resource) this.hud.setAmmo(resource, 0);
    }
  }

  getEquipped(entity) {
    return this.getInventory(entity)?.equipped ?? null;
  }

  // Plain, persistence-shaped snapshot -- e.g. for a future map-
  // transition rule to hand to User.setState({ inventory: snapshot }).
  // Returns null rather than throwing if the entity has no inventory.
  getSnapshot(entity) {
    const inventory = this.getInventory(entity);
    if (!inventory) return null;

    return { items: [...inventory.items], equipped: inventory.equipped };
  }
}
