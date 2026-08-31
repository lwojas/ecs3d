export class PatrolComponent {
  constructor(entity, data) {
    this.enabled = true;
    this.entity = entity;
    this.patrolPoints = data.patrolPoints || [];
    this.currentPatrolIndex = 0;
    this.speed = data.speed || 2;
  }
}
