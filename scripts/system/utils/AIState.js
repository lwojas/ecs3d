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

function resolveState(stateComp) {
  const controlComp = stateComp.entity.getComponent("ControlIntentComponent");
  if (!controlComp) return;
  controlComp.state = stateComp.state;
}

function resolveDefaultIntent(stateComp, targetComp) {
  targetComp.target = stateComp.decision.entity;
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
  resolveState(stateComp);
}

function resolveEscortIntent(stateComp, targetComp, goalComp) {
  // console.log(stateComp);
  // if (!stateComp.decision) {
  //   targetComp.target = goalComp.targetId;
  //   const movementComp = stateComp.entity.getComponent("MovementComponent");
  //   movementComp.speed = movementComp.maxSpeed;
  //   stateComp.state = "MOVETO";
  //   return;
  // }
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
      targetComp.target = stateComp.decision.entity;
      if (
        escortSprite &&
        entitySprite &&
        isWithinRange(entitySprite, escortSprite, 300)
      ) {
        console.log("Attacking target");
        const movementComp = stateComp.entity.getComponent("MovementComponent");
        movementComp.speed = 15;
        stateComp.state = "ATTACK";
        break;
      }
      console.log("Moving to escort target");

      targetComp.target = goalComp.targetId;
      const movementComp = stateComp.entity.getComponent("MovementComponent");
      movementComp.speed = movementComp.maxSpeed;
      stateComp.state = "MOVETO";
      break;
    case "NO_TARGET":
      // console.log("[AIState]: no target");
      targetComp.target = goalComp.targetId;
      const moveComp = stateComp.entity.getComponent("MovementComponent");
      moveComp.speed = moveComp.maxSpeed;
      stateComp.state = "MOVETO";
      break;
    // console.log(stateComp.state);
    default:
      stateComp.state = "IDLE";
  }
  resolveState(stateComp);
}
