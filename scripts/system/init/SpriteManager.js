export class SpriteManager {
  constructor() {
    this.entities = new Map();
  }

  createSprite(entity) {
    let spriteComponent = entity.getComponent("SpriteComponent");
    if (spriteComponent) {
      let sprite = this.entities.get(entity);
      if (sprite) {
        sprite.destroy();
        console.log("Destroying sprite");
      }
      let position = entity.getComponent("Position") || { x: 100, y: 100 };
      this.entities.set(
        entity,
        (this.sprite = game.add.sprite(
          position.x,
          position.y,
          spriteComponent.spriteKey
        ))
      );
      spriteComponent.sprite = this.entities.get(entity);
    }
  }
}
