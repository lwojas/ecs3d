export class TweenComponent {
  static editor = {
    fields: {
      tweens: {
        type: "array",
      },
    },
  };

  constructor(entity, data = {}) {
    this.entity = entity;

    this.tweens = (data.tweens || []).map((tween) => ({
      // Identity
      id: tween.id,

      // Target
      component: tween.component,
      property: tween.property || [],

      // Values
      // `from` may be omitted to capture the current value when started.
      from: tween.from,
      to: tween.to,

      // Timing
      duration: tween.duration ?? 1000,
      delay: tween.delay ?? 0,

      // Behaviour
      easing: tween.easing ?? "linear",
      loop: tween.loop ?? false,
      yoyo: tween.yoyo ?? false,

      // Runtime state
      active: tween.active ?? false,
      started: false,
      elapsed: 0,
      delayElapsed: 0,
      direction: 1,
    }));
  }
}
