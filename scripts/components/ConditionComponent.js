export class ConditionComponent {
  static editor = {
    fields: {
      conditions: { type: "array" },
    },
  };
  constructor(entity, data = {}) {
    this.entity = entity;
    this.conditions = Array.isArray(data.conditions) ? data.conditions : [];
  }
}
