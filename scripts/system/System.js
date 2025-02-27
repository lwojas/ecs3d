import { ServiceLocator } from "../services/ServiceLocator.js";

export class System {
  constructor() {
    this.systemListeners = new Map();
    this.listenerList = [];
    // this.entities;
    this.entityManager = ServiceLocator.resolve("game", "EntityManager");
  }

  addSystemListener(listener) {
    if (listener) {
      this.listenerList.push(listener);
      this.systemListeners.set(listener, this.listenerList.length - 1);
    }
  }

  removeSystemListener(listener) {
    this.listenerList.splice(this.systemListeners.get(listener));
    this.systemListeners.delete(listener);
  }

  getSystemListener(listener) {
    this.systemListeners.get(listener);
  }

  sendUpdate(args) {
    this.listenerList.forEach((listener) => {
      listener.receiveUpdate(this.entities, args);
    });
  }
  sendControl(args) {
    this.listenerList.forEach((listener) => {
      listener.receiveControl(this.entities, args);
    });
  }
  sendInteraction(args) {
    this.listenerList.forEach((listener) => {
      listener.receiveInteraction(this.entities, args);
    });
  }
  receiveControl() {}
  receiveInteraction() {}
  receiveUpdate() {}
}
