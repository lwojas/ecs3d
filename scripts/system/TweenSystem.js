import { resolveComponentList } from "../tools/componentResolver.js";

import { System } from "./System.js";

export class TweenSystem extends System {
  constructor() {
    super();

    this.entities = this.entityManager.registerSystem(this, ["TweenComponent"]);

    this.refreshList();
  }

  refreshList() {
    this.tweenList = resolveComponentList("TweenComponent", this.entities);
    console.log(this.tweenList);
  }

  update(dt) {
    const delta = dt * 1000;
    // console.log(delta);
    const len = this.tweenList.length;

    for (let i = 0; i < len; i++) {
      const tweenComponent = this.tweenList[i];

      const tweens = tweenComponent.tweens;

      for (let j = 0; j < tweens.length; j++) {
        const tween = tweens[j];

        if (!tween.active) continue;

        this.updateTween(tweenComponent.entity, tween, delta);
      }
    }
  }

  updateTween(entity, tween, delta) {
    const targetComponent = entity.getComponent(tween.component);

    if (!targetComponent) {
      console.warn(
        `Tween "${tween.id}" could not find component "${tween.component}".`,
      );

      tween.active = false;

      return;
    }

    const resolved = this.resolveProperty(targetComponent, tween.property);

    if (!resolved) {
      console.warn(
        `Tween "${tween.id}" could not resolve property path:`,
        tween.property,
      );

      tween.active = false;

      return;
    }

    const currentValue = resolved.target[resolved.property];

    // Tweens only support numerical properties.
    if (typeof currentValue !== "number") {
      console.warn(
        `Tween "${tween.id}" target property must be numeric:`,
        tween.property,
      );

      tween.active = false;

      return;
    }

    // Capture the starting value when the tween actually starts.
    if (!tween.started) {
      tween.started = true;

      if (tween.from === undefined || tween.from === null) {
        tween.from = currentValue;
      }
    }

    // Handle delay without mutating the configured delay.
    if (tween.delayElapsed < tween.delay) {
      tween.delayElapsed += delta;

      return;
    }

    tween.elapsed += delta;

    const progress =
      tween.duration <= 0 ? 1 : Math.min(tween.elapsed / tween.duration, 1);

    const easedProgress = this.applyEasing(progress, tween.easing);

    const from = tween.direction === 1 ? tween.from : tween.to;

    const to = tween.direction === 1 ? tween.to : tween.from;

    resolved.target[resolved.property] = from + (to - from) * easedProgress;

    if (progress < 1) {
      return;
    }

    // Completed.
    if (tween.loop) {
      tween.elapsed = 0;

      tween.delayElapsed = 0;

      if (tween.yoyo) {
        tween.direction *= -1;
      }

      return;
    }

    // One-shot tween is now inactive.
    tween.active = false;
  }

  resolveProperty(target, path) {
    if (!Array.isArray(path) || path.length === 0) {
      return null;
    }

    let current = target;

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];

      if (current === undefined || current === null) {
        return null;
      }
    }

    return {
      target: current,
      property: path[path.length - 1],
    };
  }

  applyEasing(progress, easing) {
    switch (easing) {
      case "easeInQuad":
        return progress * progress;

      case "easeOutQuad":
        return 1 - (1 - progress) * (1 - progress);

      case "easeInOutQuad":
        return progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      case "linear":
      default:
        return progress;
    }
  }

  start(entity, tweenId) {
    const tween = this.getTween(entity, tweenId);

    if (!tween) {
      return false;
    }

    tween.active = true;

    tween.started = false;

    tween.elapsed = 0;

    tween.delayElapsed = 0;

    tween.direction = 1;

    return true;
  }

  stop(entity, tweenId) {
    const tween = this.getTween(entity, tweenId);

    if (!tween) {
      return false;
    }

    tween.active = false;

    return true;
  }

  restart(entity, tweenId) {
    return this.start(entity, tweenId);
  }

  reverse(entity, tweenId) {
    const tween = this.getTween(entity, tweenId);

    if (!tween) {
      return false;
    }

    tween.active = true;

    tween.started = true;

    tween.direction *= -1;

    tween.elapsed = 0;

    tween.delayElapsed = 0;

    return true;
  }

  getTween(entity, tweenId) {
    const tweenComponent = entity.getComponent("TweenComponent");

    if (!tweenComponent) {
      return null;
    }

    return tweenComponent.tweens.find((tween) => tween.id === tweenId) || null;
  }
}
