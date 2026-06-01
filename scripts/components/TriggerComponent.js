export class TriggerComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.action = data.action;
    this.enabled = data.enabled ?? true;
    this.runOnce = data.runOnce;
    this.args = data.args;
  }
}
