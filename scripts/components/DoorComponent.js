export class DoorComponent {
  static editor = {
    fields: {
      state: { type: "string" },
    },
  };
  constructor(entity, data) {
    this.entity = entity;
    this.state = data.state || "open";
    this.enabled = true;
  }
}
