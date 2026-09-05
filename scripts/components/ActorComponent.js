export class ActorComponent {
  static editor = {
    fields: {
      team: { type: "string" },
    },
  };

  constructor(entity, data) {
    this.entity = entity;
    this.enabled = true;
    this.team = data.team || "none";
  }
}
