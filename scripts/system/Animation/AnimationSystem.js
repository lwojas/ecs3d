import { resolveComponentList } from "../../tools/componentResolver.js";
import { System } from "../System.js";
import { SPRITE_ANIMATIONS } from "./spriteAnimations.js";

export class AnimationSystem extends System {
  constructor() {
    super();

    this.entities = this.entityManager.registerSystem(this, [
      "AnimationComponent",
      "SpriteComponent",
    ]);

    this.refreshList();
  }

  refreshList() {
    this.animationList = resolveComponentList(
      "AnimationComponent",
      this.entities,
    );

    this.spriteList = resolveComponentList("SpriteComponent", this.entities);
  }

  play(entity, animationKey) {
    const definition = SPRITE_ANIMATIONS[animationKey];

    if (!definition) {
      console.warn(`Unknown sprite animation: ${animationKey}`);
      return;
    }
    const animation = entity.getComponent("AnimationComponent");
    if (animation.animation === animationKey) {
      return;
    }

    animation.animation = animationKey;
    animation.frame = 0;
    animation.elapsed = 0;
    animation.playing = true;
  }

  stop(animation) {
    animation.playing = false;
  }

  update(delta) {
    const len = this.animationList.length;

    for (let i = 0; i < len; i++) {
      const animation = this.animationList[i];
      const sprite = this.spriteList[i];

      if (!animation.enabled || !animation.playing) {
        continue;
      }

      const definition = SPRITE_ANIMATIONS[animation.animation];

      if (!definition || !definition.frames.length) {
        continue;
      }

      animation.elapsed += delta;

      while (animation.elapsed >= definition.frameDuration) {
        animation.elapsed -= definition.frameDuration;
        animation.frame++;

        if (animation.frame >= definition.frames.length) {
          if (definition.loop) {
            animation.frame = 0;
          } else {
            animation.frame = definition.frames.length - 1;
            animation.playing = false;

            break;
          }
        }
      }

      sprite.texture = definition.frames[animation.frame];
    }
  }
}
