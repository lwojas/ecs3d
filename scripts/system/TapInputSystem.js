import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";

export class TapInputSystem extends System {
  constructor() {
    super();
    // this.entities = this.entityManager.registet
    game.input.onUp.add(this.processTap, this);
    this.eventSystem = ServiceLocator.resolve("game", "EventSystem");
  }

  processTap(pointer) {
    const pointerPosition = {
      x: pointer.position.x + game.camera.x,
      y: pointer.position.y + game.camera.y,
    };
    this.eventSystem.emit("G_TAP_INPUT_UP", pointerPosition);
  }
}
