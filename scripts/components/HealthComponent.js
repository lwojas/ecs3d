export class HealthComponent {
  static editor = {
    fields: {
      maximum: { type: "number" },
      invulnerable: { type: "boolean" },
    },
  };

  constructor(entity, data) {
    this.enabled = true;
    this.entity = entity;
    this.maximum = data.maximum || 100;
    this.current = data.maximum || 100;
    this.invulnerable = false;
  }
}
