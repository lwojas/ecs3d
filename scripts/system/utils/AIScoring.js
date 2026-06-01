export function scoreEntity(entity, targerEntity) {
  // console.log(targerEntity);
  const aggression = entity.getComponent("EmotionComponent")?.aggression || 0;
  const entityHealth = entity.getComponent("HealthComponent");
  const factionComponent = entity.getComponent("FactionComponent");
  const intelligenceComp = entity.getComponent("IntelligenceComponent");

  const targetFactionComp = targerEntity.getComponent("FactionComponent");
  const targetHealth = targerEntity.getComponent("HealthComponent");

  // console.log(entity, aggression, factionComponent.faction);

  const factionScores = {};

  for (let faction in factionComponent.faction) {
    factionScores[faction] =
      factionComponent.faction[faction] * targetFactionComp.faction[faction];
  }

  const entityFaction = getFaction(factionComponent.faction);

  const targetEntityFaction = getFaction(targetFactionComp.faction);
  const targetFactionScore = factionScores[targetEntityFaction];

  const strengthRatio = entityHealth.health / targetHealth.health;

  const targetFinalScore =
    strengthRatio * Math.abs(targetFactionScore) * aggression;

  // let intent;

  // if (targetFinalScore < -20000) {
  //   intent = "flee";
  // }

  // if (targetFinalScore < -20000) {
  //   intent = "flee";
  // }

  // console.log(
  //   entity.id,
  //   " is targeting: ",
  //   targerEntity.id,
  //   "belongs to faction: ",
  //   entityFaction,
  //   factionScores,
  //   "Final score:::",
  //   strengthRatio * Math.abs(targetFactionScore) * aggression
  // );

  return targetFinalScore;
}

function getFaction(scores) {
  const lowestKey = Object.keys(scores).reduce((minKey, key) =>
    scores[key] < scores[minKey] ? key : minKey
  );
  return lowestKey;
}

// export function scoreFaction(entity, target){}
