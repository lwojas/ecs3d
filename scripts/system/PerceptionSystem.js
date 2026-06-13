import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { drawDebugCircle } from "./utils/debugTools.js";

export class PerceptionSystem extends System {
  constructor() {
    super();
    this.cooldown = 2000;
    this.debugSystem = ServiceLocator.resolve("game", "DebugSystem");

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
          entity.getComponent("FactionComponent").faction,
      );
      perceptionComponent.scanList = this.entityManager.makeSpriteList(
        perceptionComponent.entityList,
      );
    });
    this.perceptionSprites = this.entityManager.makeSpriteList(
      this.perceptionEntities,
    );
    console.log(this.perceptionEntities);
  }

  update(delta) {
    // const delta = game.time.now;
    this._scanTimer = this._scanTimer || 0;
    if (delta < this._scanTimer) return;
    // console.log("Pulse");
    this._scanTimer = delta + this.cooldown;

    this.perceptionEntities.forEach((entity) => {
      const spriteComponent = entity.getComponent("SpriteComponent");
      // if (!spriteComponent.sprite.alive) return;
      const perceptionComponent = entity.getComponent("PerceptionComponent");
      perceptionComponent.visibleEntities = [];
      const foundEntities = [];
      let spriteToCheck = null;
      if (entity.hasComponent("GoalComponent")) {
        spriteToCheck = entity
          .getComponent("GoalComponent")
          .targetId?.getComponent("SpriteComponent")?.sprite;
      }
      // drawDebugCircle(
      //   this.debugSystem.debugData.ctx,
      //   spriteComponent.sprite.x,
      //   spriteComponent.sprite.y,
      //   perceptionComponent.detectionRadius,
      // );
      perceptionComponent.scanList.forEach((sprite) => {
        if (
          spriteComponent.sprite === sprite ||
          spriteToCheck === sprite ||
          !sprite.alive
        )
          return;
        if (
          Math.abs(sprite.x - spriteComponent.sprite.x) <
            perceptionComponent.detectionRadius &&
          Math.abs(sprite.y - spriteComponent.sprite.y) <
            perceptionComponent.detectionRadius
        ) {
          drawDebugCircle(
            this.debugSystem.debugData.ctx,
            sprite.x,
            sprite.y,
            30,
          );
          foundEntities.push(sprite.parentEntity);
        }
      });

      perceptionComponent.visibleEntities = foundEntities;
    });
  }
}
