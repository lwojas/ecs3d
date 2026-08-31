export class LightComponent {
  constructor(entity, data) {
    this.enabled = data.enabled ?? true;
    this.entity = entity;
    this.x = data.x || 14;
    this.y = data.y || 14;
    this.z = data.z || 1;
    this.radius = data.radius || 20;
    this.intensity = data.intensity || 1.5;
    this.tint = data.tint || { r: 0, g: 0, b: 255 };
  }
}
