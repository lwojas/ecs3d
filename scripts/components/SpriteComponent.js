export class SpriteComponent {
  constructor(entity, data) {
    this.existed = false;
    // let existingComponent = entity.getComponent("SpriteComponent");
    // console.log(existingComponent);
    if (entity.getComponent("SpriteComponent")) {
      console.log(entity);
      entity.removeComponent("SpriteComponent");
      this.existed = true;
    }
    this.entity = entity;
    let position = entity.getComponent("Position") || { x: 100, y: 100 };
    this.sprite = game.add.sprite(position.x, position.y, data.spriteKey);
    this.sprite.parentEntity = entity;
  }

  onmount(entity) {
    if (this.existed) {
      entity.refreshComponents("SpriteComponent");
    }
  }

  unmount() {
    let position = this.entity.getComponent("Position");
    if (position) {
      position.x = this.sprite.world.x;
      position.y = this.sprite.world.y;
    }
    this.sprite.destroy();
  }
}
