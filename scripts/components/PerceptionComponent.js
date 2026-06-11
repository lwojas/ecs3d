export class PerceptionComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.detectionRadius = data.radius || 300;
    this.scanList = [];
    this.visibleEntities = [];
  }
}
