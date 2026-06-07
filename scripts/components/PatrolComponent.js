export class PatrolComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.currentIndex = data.currentIndex || 0;
    this.currentPatrolAction = data.currentPatrolAction || "default";
  }
}
