export class MovementComponent {
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
  }
}
