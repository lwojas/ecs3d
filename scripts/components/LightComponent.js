export class LightComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.sprites = data.sprites || ["defaultLight"];
    this.lightSprites = [];
    this.position;
    this.castShadows = data.castShadows || false;
    this.isSpot = data.isSpot || false;
    this.distance = data.distance || 300;
    this.radius = data.radius || 300;
    this.color = { r: 255, g: 255, b: 255 };
    this.rotation = data.rotation || 0;
  }
}
