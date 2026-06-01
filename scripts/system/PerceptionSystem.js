import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";

export class PerceptionSystem extends System {
  constructor() {
    super();
    this.cooldown = 2000;
    // this._scanTimer = 0;
    this.perceptionEntities = this.entityManager.registerSystem(this, [
      "PerceptionComponent",
    ]);
    this.factionEntities = this.entityManager.registerSystem(this, [
      "FactionComponent",
    ]);
    this.perceptionEntities.forEach((entity) => {
      const perceptionComponent = entity.getComponent("PerceptionComponent");
      perceptionComponent.entityList = this.factionEntities.filter(
        (factionEntity) =>
          factionEntity.getComponent("FactionComponent").faction !==
          entity.getComponent("FactionComponent").faction
      );
      perceptionComponent.scanList = this.entityManager.makeSpriteList(
        perceptionComponent.entityList
      );
    });
    this.perceptionSprites = this.entityManager.makeSpriteList(
      this.perceptionEntities
    );
    console.log(this.perceptionEntities);
  }

  update() {
    const delta = game.time.now;
    this._scanTimer = this._scanTimer || 0;
    if (delta < this._scanTimer) return;
    // console.log("Pulse");
    this._scanTimer = delta + this.cooldown;

    this.perceptionEntities.forEach((entity) => {
      const spriteComponent = entity.getComponent("SpriteComponent");
      const perceptionComponent = entity.getComponent("PerceptionComponent");
      perceptionComponent.visibleEntities = [];

      perceptionComponent.scanList.forEach((sprite) => {
        if (spriteComponent.sprite === sprite || !sprite.alive) return;
        // console.log(Math.abs(sprite.x - spriteComponent.sprite.x));
        if (
          Math.abs(sprite.x - spriteComponent.sprite.x) <
            perceptionComponent.detectionRadius &&
          Math.abs(sprite.y - spriteComponent.sprite.y) <
            perceptionComponent.detectionRadius
        ) {
          perceptionComponent.visibleEntities.push(sprite.parentEntity);
          //   console.log(this._scanTimer);
          //  Do stuff if sprite is in range
          //   console.log(
          //     entity.id,
          //     "has detected the following entity: ",
          //     sprite.parentEntity.id
          //   );
        }
      });
      // console.log(perceptionComponent.visibleEntities);
      // this.sendUpdate(perceptionComponent.visibleEntities);
      ServiceLocator.resolve("game", "EventSystem").emit(
        "G_PERCEPTION_PULSE",
        entity,
        perceptionComponent.visibleEntities
      );
    });
  }
}
