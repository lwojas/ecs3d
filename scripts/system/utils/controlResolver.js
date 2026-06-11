import { setAIState } from "./AIState.js";

export function controlResolver(entity, command) {
  if (entity.hasComponent("InputComponent")) {
    useInputIntent(entity, command);
  } else {
    useAIIntent(entity);
  }
}

function useInputIntent(entity, command) {
  const controlComp = entity.getComponent("ControlIntentComponent");
  const motionStateComp = entity.getComponent("MotionShipComponent");
  if (!controlComp && motionStateComp) return;
  const action = motionStateComp.transitions[motionStateComp.state][command];
  if (action) {
    action();
  } else {
    console.log("No state found for this action", command);
  }
  controlComp.state = motionStateComp.state;
}

function useAIIntent(entity) {
  setAIState(entity);
}
