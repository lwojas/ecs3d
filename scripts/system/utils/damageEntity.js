export function damageEntity(target, source) {
  const damageComponent = source.parentEntity.getComponent("DamageComponent");
  const healthComponent = target.parentEntity.getComponent("HealthComponent");
  if (!damageComponent) return;
  if (!healthComponent) return;
  // console.log(
  //   "[DamageEntity] Damaging",
  //   target.parentEntity,
  //   "for",
  //   damageComponent.amount,
  //   "health remaining:",
  //   healthComponent.health,
  // );

  healthComponent.health -= damageComponent.amount;
}
