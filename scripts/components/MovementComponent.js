export class MovementComponent {
  static editor = {
    fields: {
      x: { type: "number" },
      y: { type: "number" },
      z: { type: "number" },
      angle: { type: "number" },
      viewAngle: { type: "number" },
      mouseSensitivity: { type: "number" },
      speed: { type: "number" },
      movable: { type: "boolean" },
    },
  };

  constructor(entity, data) {
    this.entity = entity;
    this.enabled = true;
    this.x = data.x || 14;
    this.y = data.y || 14;
    this.z = data.z ?? 0;

    this.angle = data.angle || 0;
    this.viewAngle = data.viewAngle || 0;
    this.mouseSensitivity = data.mouseSensitivity || 0.0025;
    this.speed = data.speed || 8;
    this.moveX = 0;
    this.moveY = 0;
    this.movable = data.movable ?? true;
    this.verticalVelocity = 0;
    this.gravity = 100;
  }
}
