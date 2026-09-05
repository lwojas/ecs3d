export class ConditionalChecker {
  constructor(inventorySystem) {
    this.inventorySystem = inventorySystem;

    this.handlers = {
      hasItem: this.hasItem.bind(this),
      hasComponent: this.hasComponent.bind(this),
      compare: this.compare.bind(this),
    };
  }

  evaluate(conditionComponent, context = {}) {
    if (!conditionComponent) {
      return true;
    }

    const conditions = conditionComponent.conditions;

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return true;
    }

    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    return true;
  }

  evaluateCondition(condition, context) {
    if (!condition) {
      return true;
    }

    const handler = this.handlers[condition.type];

    if (!handler) {
      return false;
    }

    return !!handler(condition, context);
  }

  hasItem(condition, context) {
    const entity = context.activator;

    if (!entity || !this.inventorySystem) {
      return false;
    }

    return this.inventorySystem.has(entity, condition.item);
  }

  hasComponent(condition, context) {
    const entity = this.resolveTarget(condition, context);

    if (!entity) {
      return false;
    }

    return entity.hasComponent(condition.component);
  }

  compare(condition, context) {
    const target = this.resolveTarget(condition, context);

    if (!target) {
      return false;
    }

    const actual = this.resolveValue(target, condition.property);

    const expected = condition.value;

    switch (condition.operator) {
      case "==":
        return actual === expected;

      case "!=":
        return actual !== expected;

      case "<":
        return actual < expected;

      case "<=":
        return actual <= expected;

      case ">":
        return actual > expected;

      case ">=":
        return actual >= expected;

      default:
        return false;
    }
  }

  resolveTarget(condition, context) {
    if (!condition.target || condition.target === "activator") {
      return context.activator;
    }

    if (condition.target === "entity") {
      return context.entity;
    }

    if (condition.target === "trigger") {
      return context.trigger;
    }

    if (typeof condition.target === "string") {
      return context[condition.target];
    }

    return null;
  }

  resolveValue(target, property) {
    if (!target || !property) {
      return undefined;
    }

    const parts = property.split(".");
    let value = target;

    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }

      value = value[part];
    }

    return value;
  }
}
