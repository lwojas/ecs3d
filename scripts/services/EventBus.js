import { ServiceLocator } from "./ServiceLocator.js";

export class EventBus {
  constructor(domain, { debug = false } = {}) {
    this.events = {};
    this.debug = debug;
    ServiceLocator.register(domain, "EventSystem", this);
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  // Returns whether anything was listening. A data-driven trigger/action
  // layer will routinely emit events nobody's registered a handler for
  // yet (e.g. "pickup.collect" before any pickup system exists) -- that's
  // not an error, so the warning below only fires when debug is enabled.
  emit(eventName, ...args) {
    const listeners = this.events[eventName];

    if (!listeners || listeners.length === 0) {
      if (this.debug) {
        console.warn(`No event listener registered for ${eventName}`);
      }
      return false;
    }

    listeners.forEach((callback) => callback(...args));
    return true;
  }
}
