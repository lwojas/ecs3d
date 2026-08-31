export class TransformComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.transformations = {
      rotate: { x: 0, y: 0, z: 2 },
    };
    this.loop = true;
    this.elapsed = 0;
  }
}
