export class MovementComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.maxSpeed = data.maxSpeed;
    this.maxAngular = data.maxAngular || 200;
    this.maxVelocity = data.maxVelocity || 200;
    this.drag = data.drag || 100;
    // Add more props to json
  }
}
