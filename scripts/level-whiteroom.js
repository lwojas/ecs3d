import { Raycaster } from "./system/Raycaster.js";
import { testLevel } from "./data/3dtestLevel.js";

export class Whiteroom {
  preload() {
    this.load.image("wallTexture", "assets/textures/wall.png");

    this.load.image("floorTexture", "assets/textures/floor.png");

    this.load.image("ceilingTexture", "assets/textures/ceiling.png");

    this.load.image("brickTexture", "assets/textures/brick.png");
  }

  create() {
    this.raycaster = new Raycaster(this.game, testLevel, {
      width: 320,
      height: 180,
      debugSpriteAnchors: true,
      cellSize: 4,

      wallHeight: 16,
      cameraHeight: 4,

      fov: Math.PI / 3,

      maxDistance: 1000,
    });

    this.raycaster.resizeToCamera();

    this.player = {
      x: 14,
      y: 14,

      angle: 0,

      speed: 8,
    };

    // Renderer-facing billboard data. This is deliberately plain data rather
    // than a Phaser sprite or ECS entity.
    this.testSprites = [
      {
        x: 28,
        y: 12,
        z: 0,
        width: 1,
        height: 1,
        scale: 16,
        texture: "Cobra",
      },
    ];

    // Renderer-facing lighting data (P8-02). Just as with sprites, this is
    // plain per-frame data the Raycaster only turns into pixel brightness --
    // it owns no light lifecycle. Stands in for a future ECS LightSystem.
    this.testLights = [
      {
        x: 28,
        y: 20,
        z: 3,
        radius: 20,
        intensity: 1.5,
        tint: { r: 255, g: 180, b: 120 },
      },
    ];
    this.ambient = 0.35;

    this.keys = this.game.input.keyboard.addKeys({
      forward: Phaser.Keyboard.W,

      backward: Phaser.Keyboard.S,

      left: Phaser.Keyboard.A,

      right: Phaser.Keyboard.D,
    });
  }

  update() {
    const dt = this.game.time.elapsed / 1000;

    const player = this.player;

    if (this.keys.left.isDown) {
      player.angle -= 2.5 * dt;
    }

    if (this.keys.right.isDown) {
      player.angle += 2.5 * dt;
    }

    let moveX = 0;
    let moveY = 0;

    if (this.keys.forward.isDown) {
      moveX += Math.cos(player.angle);

      moveY += Math.sin(player.angle);
    }

    if (this.keys.backward.isDown) {
      moveX -= Math.cos(player.angle);

      moveY -= Math.sin(player.angle);
    }

    const length = Math.sqrt(moveX * moveX + moveY * moveY);

    if (length > 0) {
      moveX /= length;
      moveY /= length;

      const distance = player.speed * dt;

      const nextX = player.x + moveX * distance;

      const nextY = player.y + moveY * distance;

      if (!this.raycaster.isWallWorld(nextX, player.y)) {
        player.x = nextX;
      }

      if (!this.raycaster.isWallWorld(player.x, nextY)) {
        player.y = nextY;
      }
    }

    player.z = this.raycaster.getEyeHeightWorld(player.x, player.y);

    const camera = this.raycaster.createCameraSnapshot(player);
    camera.sprites = this.testSprites;
    camera.lights = this.testLights;
    camera.ambient = this.ambient;
    this.raycaster.renderSnapshot(camera);
  }

  shutdown() {
    if (this.raycaster) {
      this.raycaster.destroy();
      this.raycaster = null;
    }
  }
}
