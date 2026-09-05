// The central place that owns which gameplay systems handle which
// semantic action events -- the same idea Events.js's registerEvents()
// gestured at (one place that calls eventBus.on() and does something
// useful with a known system), built out properly: named placeholders
// for real systems, set once at level start, each route checking its
// placeholder before using it. TriggerSystem (or anything else) only
// ever needs to know the EventBus, never this class or any system it
// routes to.
//
// Adding a future route (door.set, sound.play, pickup.collect, ...)
// means adding one more placeholder + registerX() + handleX() here --

import { addResource } from "../system/ResourceSystem.js";

// nothing upstream of the EventBus changes.
export class EventRouter {
  constructor(eventBus) {
    this.eventBus = eventBus;

    // Placeholders -- set via registerX() below, checked before use in
    // every route. `hud` isn't wired to any route yet; it's here to
    // show the pattern scales past a single system, per the brief.
    this.lightingSystem = null;
    this.hud = null;
    this.inventorySystem = null;
    this.audioSystem = null;
    this.pickupSystem = null;

    this.eventBus.on("lights.set", (data) => this.handleLightsSet(data));
    this.eventBus.on("resource.add", (data) => this.consumePickup(data));
  }

  registerHud(hud) {
    this.hud = hud;
  }

  registerInventory(inventory) {
    this.inventorySystem = inventory;
  }

  registerPickupSystem(pickup) {
    this.pickupSystem = pickup;
  }

  // Lighting events

  registerLightingSystem(system) {
    this.lightingSystem = system;
  }

  registerAudioSystem(system) {
    this.audioSystem = system;
  }

  handleLightsSet(data) {
    if (!this.lightingSystem) return;
    this.lightingSystem.setLights(data);
  }

  consumePickup(data) {
    if (!this.pickupSystem) return;
    this.pickupSystem.collectPickup(data);
    // const pickup = data.trigger.getComponent("PickupComponent");
    // const resourceComponent = data.activator.getComponent("ResourceComponent");
    // if (!resourceComponent) return;
    // addResource(resourceComponent, pickup);
    // if (!this.inventorySystem || !data.activator.hasComponent("HudComponent"))
    //   return;
    // this.inventorySystem.syncHud(data.activator);
    // this.hud.notify(`+ ${pickup.amount} ${pickup.type}`, 600);
    // if (this.audioSystem) {
    //   this.audioSystem.play("pickup");
    // }
    // console.log(data);
  }
}
