export class AnimationComponent {
  static editor = {
    fields: {
      animation: { type: "string" },
    },
  };
  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;
    this.animation = data.animation ?? null;
    this.frame = 0;
    this.elapsed = 0;
    this.playing = false;
  }
}
