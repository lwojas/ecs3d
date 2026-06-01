export class EmotionComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.aggression = data.aggression || 0;
    // this.emotion = data.emotion || "calm";
  }
}
