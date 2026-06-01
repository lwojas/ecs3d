import { ServiceLocator } from "../services/ServiceLocator.js";
import { spriteLayers } from "./utils/spriteLayers.js";

export class DebugSystem {
  constructor() {
    this.debugData = game.make.bitmapData(
      game.camera.width,
      game.camera.height
    );
    this.debugLayer = game.add.sprite(0, 0, this.debugData);
    const testSprite = game.add.sprite(10, 10, "defaultObject");
    // this.debugLayer.blendMode = PIXI.blendModes.MULTIPLY;
    spriteLayers.debug.add(this.debugLayer);
    this.debugLayer.fixedToCamera = true;
    ServiceLocator.register("game", "DebugSystem", this);
  }
  update() {
    this.debugData.ctx.clearRect(
      0,
      0,
      this.debugData.width,
      this.debugData.height
    );
  }
}
