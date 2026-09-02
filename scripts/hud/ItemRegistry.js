// ItemRegistry.js

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

// Converts a sampleLightRgb()-style {r,g,b} multiplier (0..~2, unclamped)
// into a Phaser `sprite.tint`-compatible packed 0xRRGGBB value.
function rgbToTint({ r, g, b }) {
  return (clampChannel(r) << 16) | (clampChannel(g) << 8) | clampChannel(b);
}

export default class ItemRegistry {
  constructor(game, parent) {
    this.game = game;
    this.parent = game.add.group();
    parent.add(this.parent);

    this.items = {};
    this.equippedId = null;
    this.equippedSprite = null;
    this.bobTween = null;
    this.bobActive = false;
  }

  register(id, definition) {
    if (this.items[id]) {
      return;
    }

    const position = definition.position || {};
    const anchor = definition.anchor || {};
    const scale = definition.scale || {};

    const sprite = this.game.make.sprite(
      position.x || 0,
      position.y || 0,
      definition.key,
      definition.frame || 0,
    );

    sprite.anchor.setTo(
      anchor.x !== undefined ? anchor.x : 0.5,
      anchor.y !== undefined ? anchor.y : 1,
    );

    sprite.scale.setTo(
      scale.x !== undefined ? scale.x : 1,
      scale.y !== undefined ? scale.y : 1,
    );

    const states = definition.states || {};

    Object.keys(states).forEach((stateId) => {
      const state = states[stateId];

      sprite.animations.add(
        stateId,
        state.frames || [state.frame || 0],
        state.speed || 10,
        state.loop || false,
      );
    });

    this.items[id] = {
      id,
      definition,
      sprite,
    };
  }

  registerAll(definitions) {
    Object.keys(definitions).forEach((id) => {
      this.register(id, definitions[id]);
    });
  }

  get(id) {
    return this.items[id] || null;
  }

  has(id) {
    return !!this.items[id];
  }

  equip(id) {
    if (this.equippedId === id) {
      return true;
    }
    const item = this.items[id];

    if (!item) {
      return false;
    }

    this.removeEquipped();

    this.equippedId = id;
    this.equippedSprite = item.sprite;

    this.parent.add(this.equippedSprite);

    this.createBobTween(item);

    this.setState(item.definition.defaultState || "idle");

    return true;
  }

  removeEquipped() {
    if (!this.equippedSprite) {
      return;
    }

    this.stopBob();

    // this.bobActive = false;

    this.parent.remove(this.equippedSprite);

    this.equippedSprite = null;
    this.equippedId = null;
  }

  setState(stateId) {
    if (!this.equippedSprite) {
      return false;
    }

    const animation = this.equippedSprite.animations.getAnimation(stateId);

    if (!animation) {
      return false;
    }

    animation.play();

    return true;
  }

  createBobTween(item) {
    const config = item.definition.bob;

    if (!config || !config.enabled) {
      return;
    }

    const sprite = item.sprite;
    const amount = 12;

    const speed = config.speed !== undefined ? config.speed : 600;

    const baseY = item.definition.position.y;
    const baseX = item.definition.position.x;

    this.bobTween = this.game.add
      .tween(sprite)
      .to(
        { y: baseY - amount, x: baseX - 15 },
        speed,
        // Phaser.Easing.Sinusoidal.InOut,
        null,
        false,
        0,
        0,
        // true,
      )
      .to(
        { y: baseY + amount, x: baseX - 18 },
        speed,
        // Phaser.Easing.Sinusoidal.InOut,
        null,
        false,
        0,
        0,
        // true,
      )
      .to(
        { y: baseY - amount / 2, x: baseX + 7 },
        speed,
        // Phaser.Easing.Sinusoidal.InOut,
        null,
        false,
        0,
        0,
      )
      .to(
        { y: baseY - amount, x: baseX + 15 },
        speed,
        // Phaser.Easing.Sinusoidal.InOut,
        null,
        false,
        0,
        0,
      )
      .to(
        { y: baseY + amount, x: baseX + 24 },
        speed,
        // Phaser.Easing.Sinusoidal.InOut,
        null,
        false,
        0,
        0,
      )
      .to(
        { y: baseY, x: baseX },
        speed,
        // Phaser.Easing.Sinusoidal.InOut,
        null,
        false,
        0,
        0,
      )
      .loop();

    // Phaser CE can destroy a tween when it is manually
    // stopped. Keep it reusable.
    // this.bobTween._destroyOnComplete = false;

    this.bobActive = false;
  }

  setBob(active) {
    if (!this.bobTween) {
      return;
    }

    if (active) {
      if (!this.bobActive) {
        this.bobActive = true;
        this.bobTween.start();
        this.bobTween.resume();
      }

      return;
    }

    if (this.bobActive) {
      this.bobActive = false;
      this.bobTween.pause();

      if (this.equippedSprite) {
        this.equippedSprite.y = this.equippedId
          ? this.items[this.equippedId].definition.position.y
          : this.equippedSprite.y;
      }
    }
  }

  stopBob() {
    if (!this.bobTween) {
      return;
    }

    this.bobActive = false;

    this.bobTween.pause();

    this.bobTween = null;
  }

  // Tints the currently equipped item sprite to match the raycaster's
  // lighting at the camera's position (see CameraRenderer.viewmodelLight),
  // so the weapon/item viewmodel isn't lit independently of the 3D scene
  // it's overlaid on. A no-op if nothing is equipped yet.
  setLightTint(light) {
    if (!this.equippedSprite || !light) {
      return;
    }

    this.equippedSprite.tint = rgbToTint(light);
  }

  getEquippedId() {
    return this.equippedId;
  }

  getEquipped() {
    return this.equippedId ? this.items[this.equippedId] : null;
  }

  hide() {
    if (this.equippedSprite) {
      this.equippedSprite.visible = false;
    }
  }

  show() {
    if (this.equippedSprite) {
      this.equippedSprite.visible = true;
    }
  }

  destroy() {
    this.stopBob();

    Object.keys(this.items).forEach((id) => {
      this.items[id].sprite.destroy();
    });

    this.items = {};
    this.equippedId = null;
    this.equippedSprite = null;
  }
}
