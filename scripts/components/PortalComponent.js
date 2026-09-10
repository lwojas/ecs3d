export class PortalComponent {
  static editor = {
    fields: {
      name: { type: "string" },
      id: { type: "string" },
      target: { type: "string" },
    },
  };
  constructor(entity, data) {
    this.entity = entity;
    this.name = data.name || "teleporter";
    this.id = data.id || "t1";
    this.target = data.target || null;
  }
}
