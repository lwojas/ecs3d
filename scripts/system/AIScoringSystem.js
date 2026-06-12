import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { scoreEntity } from "./utils/AIScoring.js";
import { setAIState } from "./utils/AIState.js";
import { controlResolver } from "./utils/controlResolver.js";

export class AIScoringSystem extends System {
  constructor() {
    super();
    this.entities = this.entityManager.registerSystem(this, [
      "AIStateComponent",
      "PerceptionComponent",
    ]);

    // ServiceLocator.resolve("game", "EventSystem").on(
    //   "G_PERCEPTION_PULSE",
    //   this.startScoring.bind(this),
    // );
  }

  update() {
    this.entities.forEach((entity) => {
      const perceptionComponent = entity.getComponent("PerceptionComponent");
      this.startScoring(entity, perceptionComponent.visibleEntities);
    });
  }

  startScoring(entity, entityList) {
    // console.log(entityList);
    if (!entity.hasComponent("AIStateComponent")) return;
    const targetComp = entity.getComponent("TargetComponent");
    if (!targetComp) return;

    const stateComp = entity.getComponent("AIStateComponent");
    const targetList = entityList.map((targetEntity) => {
      return { entity: targetEntity, score: scoreEntity(entity, targetEntity) };
    });
    if (!targetList.length) {
      const intent = { entity: null, intent: "NO_TARGET", score: 0 };
      stateComp.decision = intent;
      controlResolver(entity);
      // setAIState(entity);
      // targetComp.target = null;

      return;
    }
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
      },
    );
    // console.log(suggestedIntent);

    const targetSprite = suggestedIntent.entity.getComponent("SpriteComponent");
    stateComp.decision = suggestedIntent;
    stateComp.target = {
      x: targetSprite.sprite.x,
      y: targetSprite.sprite.y,
    };

    // targetComp.target = suggestedIntent.entity;
    // setAIState(entity);
    controlResolver(entity);

    // console.log(entity.id, stateComp.intent.entity);
    // console.log(suggestedIntent);
  }
}
