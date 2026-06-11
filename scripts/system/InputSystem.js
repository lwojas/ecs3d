import { System } from "./System.js";
import { ServiceLocator } from "../services/ServiceLocator.js";
import { controlResolver } from "./utils/controlResolver.js";

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
      f: Phaser.KeyCode.F,
    });

    // On key down
    this.keybMap.right.onDown.add(() => {
      this.updateInputState("right");
    });
    this.keybMap.left.onDown.add(() => {
      this.updateInputState("left");
    });
    this.keybMap.up.onDown.add(() => {
      this.updateInputState("up");
    });
    this.keybMap.down.onDown.add(() => {
      this.updateInputState("down");
    });

    // On key up
    this.keybMap.left.onUp.add(() => {
      this.updateInputState("leftOff");
    });
    this.keybMap.right.onUp.add(() => {
      this.updateInputState("rightOff");
    });
    this.keybMap.down.onUp.add(() => {
      this.updateInputState("downOff");
    });
    this.keybMap.up.onUp.add(() => {
      this.updateInputState("upOff");
    });

    this.keybMap.space.onDown.add(() => {
      // this.entities.forEach((entity) => {
      this.sendInteraction("space");
      // });
    });
    this.keybMap.f.onDown.add(() => {
      // this.entities.forEach((entity) => {
      this.sendInteraction("f");
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

  updateInputState(command) {
    this.entities.forEach((entity) => {
      controlResolver(entity, command);
    });
  }

  update() {
    this.entities.forEach((entity) => {
      let input = entity.getComponent("InputComponent");
      if (input) {
        // input.keyPressed = false;
        // input.keyCode = "";
      }
    });
  }
}
