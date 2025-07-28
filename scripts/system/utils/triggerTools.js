export function disableTrigger(entity) {
  if (!entity.hasComponent("TriggerComponent")) return;
  const triggerComponent = entity.getComponent("TriggerComponent");
  triggerComponent.enabled = false;
  entity.snapshot["TriggerComponent"].enabled = false;
}

export function enableTrigger(entity) {
  if (!entity.hasComponent("TriggerComponent")) return;
  const triggerComponent = entity.getComponent("TriggerComponent");
  triggerComponent.enabled = true;
  entity.snapshot["TriggerComponent"].enabled = true;
}
