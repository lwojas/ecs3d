import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { scoreEntity } from "./utils/AIScoring.js";

export class AIScoringSystem extends System {
  constructor() {
    super();

    ServiceLocator.resolve("game", "EventSystem").on(
      "G_PERCEPTION_PULSE",
      this.startScoring.bind(this)
    );
  }

  startScoring(entity, entityList) {
    const targetList = entityList.map((targetEntity) => {
      return { entity: targetEntity, score: scoreEntity(entity, targetEntity) };
    });
    if (!targetList.length) return;
    // console.log(entity.id, targetList);

    const fleeScore = targetList.reduce((previous, current) => {
      if (current.score < previous.score) return current;
      return previous;
    });
    if (fleeScore.score > 0) {
      fleeScore.score = 0;
    }
    fleeScore.intent = "FLEE";

    const attackScore = targetList.reduce((previous, current) => {
      if (current.score > previous.score) return current;
      return previous;
    });
    if (attackScore.score < 0) {
      attackScore.score = 0;
    }

    attackScore.intent = "ATTACK";
    // console.log(entity.id, fleeScore);

    const suggestedIntent = [fleeScore, attackScore].reduce(
      (previous, current) => {
        if (Math.abs(current.score) > Math.abs(previous.score)) {
          return current;
        } else {
          return previous;
        }
      }
    );
    if (!entity.hasComponent("AIStateComponent")) return;
    const stateComp = entity.getComponent("AIStateComponent");
    const targetSprite = suggestedIntent.entity.getComponent("SpriteComponent");
    stateComp.intent = suggestedIntent;
    stateComp.target = {
      x: targetSprite.sprite.x,
      y: targetSprite.sprite.y,
    };

    // console.log(entity.id, stateComp.intent.entity);
    // console.log(suggestedIntent);
  }
}
