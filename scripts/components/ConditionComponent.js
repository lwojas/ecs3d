export class ConditionComponent {
  static editor = {
    fields: {
      conditions: { type: "array" },
    },
  };
  constructor(data = {}) {
    this.conditions = Array.isArray(data.conditions) ? data.conditions : [];
  }
}
