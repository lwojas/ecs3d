import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";

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
    console.log(keyCode);

    this.entities.forEach((entity) => {
      entity.getComponent("InputComponent").keyPressed = true;
    });
  }

  triggerEvent(triggerSprite, targetSprite) {
    let triggerEntity = triggerSprite.parentEntity;
    let triggerComponent = triggerEntity.getComponent("TriggerComponent");
    let conditionComponent = triggerEntity.getComponent(
      "CheckConditionComponent"
    );
    // console.log(triggerEntity);
    if (
      conditionComponent &&
      !conditionComponent.isMet(triggerEntity, targetSprite.parentEntity)
    ) {
      return; // Conditions not met, do nothing
    }
    console.log(
      conditionComponent.isMet(triggerEntity, targetSprite.parentEntity),
      console.log(conditionComponent.conditions)
    );
    // Fire the trigger action
    console.log(`Triggering action: ${triggerComponent.action}`);
    ServiceLocator.resolve("game", "EventSystem").emit(
      triggerComponent.action,
      triggerComponent.args
    );

    // If the trigger should only run once, remove it
    if (triggerComponent.runOnce) {
      this.entityManager.removeEntity(triggerEntity);
    }
  }

  update() {
    this.overlap = game.physics.arcade.overlap(
      this.actors,
      this.targetSystem.actors,
      this.triggerEvent,
      null,
      this
    );
    this.entities.forEach((entity) => {
      let input = entity.getComponent("InputComponent");
      if (input) {
        input.keyPressed = false;
      }
    });
  }
}
