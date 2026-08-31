// ECS message bridge, see implementation in level-whiteroom.js

export class ECSBridge {
  constructor() {
    this.messages = [];
  }

  emit(message) {
    this.messages.push(message);
  }

  consumeMessages() {
    const messages = this.messages;
    this.messages = [];
    return messages;
  }
}
