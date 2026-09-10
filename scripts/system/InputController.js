// import { runtimeTargets } from "../services/RuntimeTargets.js";
import {
  runtimeBindings,
  getBindings,
  inputBindings,
} from "../tools/runtimeBindings.js";

export class InputController {
  constructor(userId, InteractionSystem) {
    this.userId = userId;
    this.runtimeBindings = getBindings(userId);
    this.inputBindings = inputBindings;
    this.InteractionSystem = InteractionSystem;
    this.mouseLook = {
      active: false,
      sensitivity: 0.0025,
    };

    // this.target = runtimeBindings.boundInput;

    this.game = game;

    // console.log(this.runtimeBindings);

    // Mouse look
    this.game.input.onDown.add(this.enableMouseLook, this);

    this.runtimeBindings.actions.resetBoundInput =
      this.bindMouseLook.bind(this);

    // Key input
    this.keys = this.game.input.keyboard.addKeys({
      forward: Phaser.Keyboard.W,

      backward: Phaser.Keyboard.S,

      left: Phaser.Keyboard.A,

      right: Phaser.Keyboard.D,
      lookUp: Phaser.Keyboard.UP,

      lookDown: Phaser.Keyboard.DOWN,
    });
  }

  sendInteraction(interaction) {
    const target = this.runtimeBindings.boundInput;
    if (interaction.leftButton.event) {
      this.InteractionSystem.updateInteraction("USE_ITEM", target, this.userId);
    }
  }

  bindMouseLook() {
    document.removeEventListener("mousemove", this.mouseMoveHandler);
    this.target = this.runtimeBindings.boundInput;

    this.mouseMoveHandler = (event) => {
      if (!this.mouseLook.active) {
        return;
      }
      this.inputBindings.pointer.movementX += event.movementX;
      this.inputBindings.pointer.movementY += event.movementY;
      this.target.angle += event.movementX * this.mouseLook.sensitivity;
      this.target.viewAngle -=
        event.movementY * this.mouseLook.sensitivity * 100;

      this.target.viewAngle = Phaser.Math.clamp(this.target.viewAngle, -80, 80);
    };
    document.addEventListener("mousemove", this.mouseMoveHandler);
  }

  enableMouseLook(event) {
    this.sendInteraction(event);
    const canvas = this.game.canvas;

    if (canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
    this.mouseLook.active = true;
  }

  disableMouseLook() {
    this.mouseLook.active = false;
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  update(delta) {
    const dt = delta;

    let isMoving = false;

    // this.target = runtimeBindings.boundInput;

    const target = this.runtimeBindings.boundInput;

    if (!target) return;

    if (this.keys.left.isDown) {
      target.angle -= 2.5 * dt;
    }

    if (this.keys.right.isDown) {
      target.angle += 2.5 * dt;
    }

    if (this.keys.lookUp.isDown) {
      target.viewAngle += 128 * dt;
    }

    if (this.keys.lookDown.isDown) {
      target.viewAngle -= 128 * dt;
    }

    let moveX = 0;
    let moveY = 0;

    if (this.keys.forward.isDown) {
      moveX += Math.cos(target.angle);

      moveY += Math.sin(target.angle);
      // this.sendMovementUpdate(target, true);
      isMoving = true;
    }

    if (this.keys.backward.isDown) {
      moveX -= Math.cos(target.angle);

      moveY -= Math.sin(target.angle);
      isMoving = true;
      // this.sendMovementUpdate(target, true);
    }

    this.InteractionSystem.updateMovement(target, isMoving);

    target.moveX = moveX;
    target.moveY = moveY;
  }
}
