import { isWithinRange } from "./rangeTools.js";

export function setAIState(entity) {
  const stateComp = entity.getComponent("AIStateComponent");
  if (!stateComp) return;
  const goalComp = entity.getComponent("GoalComponent");
  const targetComp = entity.getComponent("TargetComponent");
  const goalType = goalComp?.type || "default";

  switch (goalType) {
    case "default":
      // stateComp.state = "FLEE";
      resolveDefaultIntent(stateComp, targetComp);
      break;
    case "escort_player":
      // stateComp.state = "ATTACK";
      resolveEscortIntent(stateComp, targetComp, goalComp);
      break;
    default:
      stateComp.state = stateComp.defaultState;
  }
}

function resolveDefaultIntent(stateComp, targetComp) {
  switch (stateComp.decision.intent) {
    case "FLEE":
      stateComp.state = "FLEE";
      break;
    case "ATTACK":
      stateComp.state = "ATTACK";
      break;
    default:
      stateComp.state = "IDLE";
  }
}

function resolveEscortIntent(stateComp, targetComp, goalComp) {
  switch (stateComp.decision.intent) {
    case "FLEE":
      // stateComp.state = "FLEE";
      stateComp.state = "MOVETO";
      break;
    case "ATTACK":
      const escortSprite =
        goalComp.targetId.getComponent("SpriteComponent")?.sprite;
      const entitySprite =
        stateComp.entity.getComponent("SpriteComponent")?.sprite;
      if (
        escortSprite &&
        entitySprite &&
        isWithinRange(entitySprite, escortSprite, 400)
      ) {
        console.log("Attacking target");
        stateComp.state = "ATTACK";
        break;
      }
      console.log("Moving to escort target");
      targetComp.target = goalComp.targetId;
      stateComp.state = "MOVETO";
      break;
    default:
      stateComp.state = "IDLE";
  }
}
