export class TriggerComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.action = data.action;
    this.args = data.args;
    this.runOnce = data.runOnce;
  }
}
