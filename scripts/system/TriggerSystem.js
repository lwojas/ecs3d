import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { checkCondition } from "./utils/checkCondition.js";
import { killSprite } from "./utils/spriteTools.js";

export class TriggerSystem extends System {
  constructor(entityComponents, targetComponents) {
    super();
    this.entities = this.entityManager.registerSystem(this, entityComponents);
    this.targetSystem = {};
    this.targetSystem.entities = this.entityManager.registerSystem(
      this.targetSystem,
      targetComponents
    );
    ServiceLocator.register("game", "TriggerSystem", this);
  }

  receiveInteraction(entities, keyCode) {
    console.log("Receiving interation", keyCode);
    this.entities.forEach((entity) => {
      if (!entity.hasComponent("InputComponent")) return;
      let inputComp = entity.getComponent("InputComponent");
      inputComp.keyPressed = true;
      inputComp.keyCode = keyCode;
    });
  }

  triggerEvent(triggerSprite, targetSprite) {
    let triggerEntity = triggerSprite.parentEntity;
    let triggerComponent = triggerEntity.getComponent("TriggerComponent");
    if (!triggerComponent.enabled) return;
    // let conditionComponent = triggerEntity.getComponent(
    //   "CheckConditionComponent"
    // );

    if (
      triggerEntity.hasComponent("CheckConditionComponent") &&
      !checkCondition(triggerEntity, targetSprite.parentEntity)
    ) {
      return; // Conditions not met, do nothing
    }

    // Fire the trigger action
    console.log(`Triggering action: ${triggerComponent.action}`);
    ServiceLocator.resolve("game", "EventSystem").emit(
      triggerComponent.action,
      triggerSprite.parentEntity,
      targetSprite.parentEntity
    );

    // If the trigger should only run once, remove it
    if (triggerComponent.runOnce) {
      killSprite(triggerEntity);
    }

    if (!triggerEntity.hasComponent("InputComponent")) return;
    triggerEntity.getComponent("InputComponent").keyPressed = false;
  }

  update() {
    this.overlap = game.physics.arcade.overlap(
      this.actors,
      this.targetSystem.actors,
      this.triggerEvent,
      null,
      this
    );
  }
}
