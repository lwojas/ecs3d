export class AIStateComponent {
  constructor(data) {
    this.defaultState = data.defaultState || "IDLE";
    this.intent;
  }
}
