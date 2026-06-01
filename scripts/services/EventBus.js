import { ServiceLocator } from "./ServiceLocator.js";

export class EventBus {
  constructor(domain) {
    this.events = {};
    ServiceLocator.register(domain, "EventSystem", this);
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  emit(eventName, ...args) {
    if (this.events[eventName]) {
      this.events[eventName].forEach((callback) => callback(...args));
    } else {
      console.warn(`No event listener registered for ${eventName}`);
    }
  }
}
