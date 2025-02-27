import { System } from "./System.js";
import { ServiceLocator } from "../services/ServiceLocator.js";

export class InputSystem extends System {
  constructor(listener) {
    super();
    this.actors; // Populated by entity manager
    this.entities = this.entityManager.registerSystem(this, ["InputComponent"]);

    this.addSystemListener(listener);

    this.keybMap = game.input.keyboard.addKeys({
      up: Phaser.KeyCode.UP,
      down: Phaser.KeyCode.DOWN,
      left: Phaser.KeyCode.LEFT,
      right: Phaser.KeyCode.RIGHT,
      space: Phaser.KeyCode.SPACEBAR,
    });

    // On key down
    this.keybMap.right.onDown.add(() => {
      this.sendUpdate("right");
    });
    this.keybMap.left.onDown.add(() => {
      this.sendUpdate("left");
    });
    this.keybMap.up.onDown.add(() => {
      this.sendUpdate("up");
    });
    this.keybMap.down.onDown.add(() => {
      this.sendUpdate("down");
    });

    // On key up
    this.keybMap.left.onUp.add(() => {
      this.sendUpdate("leftOff");
    });
    this.keybMap.right.onUp.add(() => {
      this.sendUpdate("rightOff");
    });
    this.keybMap.down.onUp.add(() => {
      this.sendUpdate("downOff");
    });
    this.keybMap.up.onUp.add(() => {
      this.sendUpdate("upOff");
    });

    this.keybMap.space.onDown.add(() => {
      // this.entities.forEach((entity) => {
      this.sendInteraction("space");
      // });
    });
    // this.keybMap.space.onUp.add(() => {
    //   this.entities.forEach((entity) => {
    //     const keyPresses = entity.getComponent("InputComponent").keyPresses;
    //     keyPresses["space"] = false;
    //   });
    // });

    // BasicGame.upKey = game.input.keyboard.addKey(Phaser.Keyboard.UP);
    // BasicGame.wKey = game.input.keyboard.addKey(Phaser.Keyboard.W);
    // BasicGame.zKey = game.input.keyboard.addKey(Phaser.Keyboard.Z);
    // BasicGame.xKey = game.input.keyboard.addKey(Phaser.Keyboard.X);
    // BasicGame.downKey = game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
    // BasicGame.leftKey = game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
    // BasicGame.rightKey = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
  }
}
