export class LightComponent {
  static editor = {
    fields: {
      enabled: { type: "boolean" },
      x: { type: "number" },
      y: { type: "number" },
      z: { type: "number" },
      radius: { type: "number" },
      intensity: { type: "number" },
      tint: { type: "object" },
    },
  };

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
