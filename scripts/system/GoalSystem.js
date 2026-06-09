import { System } from "./System.js";

export class GoalSystem extends System {
  constructor(entities) {
    super();
    this.playerEntity;
    for (let entity of entities) {
      if (entity.hasComponent("PlayerComponent")) {
        this.playerEntity = entity;
      }
    }
    this.entities = this.entityManager.registerSystem(this, ["GoalComponent"]);
    for (let entity of this.entities) {
      const goalComp = entity.getComponent("GoalComponent");
      switch (goalComp.type) {
        case "escort_player":
          goalComp.targetId = this.playerEntity;
          break;
        default:
          break;
      }
    }
  }
}
