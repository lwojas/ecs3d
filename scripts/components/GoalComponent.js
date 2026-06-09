export class GoalComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.type = data.type || "default";
    this.targetId;
  }
}
