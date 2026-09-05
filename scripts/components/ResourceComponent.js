export class ResourceComponent {
  static editor = {
    fields: {
      resources: { type: "object" },
    },
  };

  constructor(entity, data) {
    this.entity = entity;
    this.resources = data || { plasma: 150 };
  }
}
