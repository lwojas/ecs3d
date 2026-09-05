export class PatrolComponent {
  static editor = {
    fields: {
      patrolPoints: { type: "array" },
      speed: { type: "number" },
    },
  };

  constructor(entity, data) {
    this.enabled = true;
    this.entity = entity;
    this.patrolPoints = data.patrolPoints || [];
    this.currentPatrolIndex = 0;
    this.speed = data.speed || 2;
  }
}
