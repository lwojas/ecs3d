export function setAIState(entity) {
  const stateComp = entity.getComponent("AIStateComponent");
  const goalComp = entity.getComponent("GoalComponent");
  if (!stateComp) return;
  switch (stateComp.decision.intent) {
    case "FLEE":
      stateComp.state = "FLEE";
      break;
    case "ATTACK":
      if (goalComp) {
        if (goalComp.type === "escort_player") {
          stateComp.state = "MOVETO";
        }
      } else {
        stateComp.state = "ATTACK";
      }
      break;
    default:
      stateComp.state = stateComp.defaultState;
  }
}
