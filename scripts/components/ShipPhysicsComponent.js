export class ShipPhysicsComponent {
  constructor(entity, data) {
    this.drag = data.drag;
    this.maxAngular = data.maxAngular;
    this.maxVelocity = data.maxVelocity;
  }
}
