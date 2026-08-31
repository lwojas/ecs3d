export class ActorComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.enabled = true;
    this.team = data.team || "none";
  }
}
