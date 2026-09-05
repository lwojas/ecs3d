import { ServiceLocator } from "../services/ServiceLocator.js";
import DynamicHUD from "./DynamicHUD.js";
import ItemRegistry from "./ItemRegistry.js";
import PersistentHUD from "./PersistentHUD.js";

// HUD.js

export default class HUD {
  constructor(game, options = {}) {
    this.game = game;
    ServiceLocator.register("game", "HUD", this);

    this.root = game.add.group();
    this.root.fixedToCamera = true;
    this.items = new ItemRegistry(game, this.root, options.itemView);
    this.persistent = new PersistentHUD(game, this.root);
    this.dynamic = new DynamicHUD(game, this.root);
  }

  // -------------------------
  // Persistent
  // -------------------------

  bringToTop() {
    this.root.parent.bringToTop(this.root);
  }

  setHealth(value) {
    this.persistent.setHealth(value);
  }

  setAmmo(current, reserve) {
    this.persistent.setAmmo(current, reserve);
  }

  setObjective(text) {
    this.persistent.setObjective(text);
  }

  // -------------------------
  // Dynamic
  // -------------------------

  notify(text, duration) {
    this.dynamic.notify(text, duration);
  }

  // -------------------------
  // Items / weapons
  // -------------------------

  registerItem(id, definition) {
    this.items.register(id, definition);
  }

  equip(id) {
    this.items.equip(id);
  }

  setItemState(id, state) {
    this.items.setState(id, state);
  }

  setItemLighting(light) {
    this.items.setLightTint(light);
  }

  getEquippedId() {
    return this.items.getEquippedId();
  }

  getItem(id) {
    return this.items.get(id);
  }

  destroy() {
    this.root.destroy();
  }

  update(delta) {
    this.items.update(delta);
  }
}
