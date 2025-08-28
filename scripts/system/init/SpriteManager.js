import { spriteLayers } from "../utils/spriteLayers.js";

export class SpriteManager {
  constructor() {
    this.entities = new Map();
  }

  createSprite(entity) {
    let spriteComponent = entity.getComponent("SpriteComponent");
    // Check if sprite already exists for this component
    let existingSprite = this.entities.get(entity);
    if (existingSprite) {
      existingSprite.destroy();
      console.log("Destroying sprite");
    }
    let position = entity.getComponent("Position") || { x: 100, y: 100 };
    console.log(position);
    const sprite = game.add.sprite(
      position.x,
      position.y,
      spriteComponent.spriteKey
    );

    sprite.scale.setTo(spriteComponent.scale);

    spriteLayers[spriteComponent.layer].add(sprite);

    sprite.parentEntity = entity;
    spriteComponent.sprite = sprite;
    this.entities.set(entity, sprite);
  }
}
