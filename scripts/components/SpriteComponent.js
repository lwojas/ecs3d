export class SpriteComponent {
  constructor(entity, data) {
    this.sprite;
    this.spriteKey = data.spriteKey;
    this.enabled = data.enabled ?? true;
    this.entity = entity;
  }

  unmount() {
    if (this.sprite) {
      this.sprite.destroy();
    }
  }
}
