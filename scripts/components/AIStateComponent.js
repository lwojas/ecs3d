export class AIStateComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.defaultState = data.defaultState || "IDLE";
    this.intent;
    this.target;
    this.state = this.defaultState;
  }
}
