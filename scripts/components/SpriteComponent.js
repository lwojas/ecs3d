export class SpriteComponent {
  constructor(entity, data) {
    this.sprite;
    this.spriteKey = data.spriteKey;
    this.enabled = data.enabled ?? true;
    this.entity = entity;
    this.layer = data.layer || "fg0";
    this.scale = data.scale || 1;
  }

  unmount() {
    if (this.sprite) {
      this.sprite.destroy();
    }
  }
}
