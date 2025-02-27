import { ServiceLocator } from "./ServiceLocator.js";

export class EventBus {
  constructor() {
    this.events = {};
    ServiceLocator.register("game", "EventSystem", this);
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  emit(eventName, args) {
    if (this.events[eventName]) {
      this.events[eventName].forEach((callback) => callback(args));
    } else {
      console.warn(`No event listener registered for ${eventName}`);
    }
  }
}
