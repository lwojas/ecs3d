export class LightComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.sprites = data.sprites || ["defaultLight"];
    this.lightSprites = [];
    this.position;
  }
}
