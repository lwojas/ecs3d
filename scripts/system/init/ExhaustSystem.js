import { TrackerComponent } from "../../components/tags/TrackerComponent.js";

export class ExhaustSystem {
  constructor() {
    this.exhaustEntities = new Map();
    // this.entities = this.entityManager.registerSystem(this, [
    //   "ShipExhaustComponent",
    // ]);
    // this.entities.forEach((entity) => {
    //   this.createExhaust(entity);
    // });
  }

  createExhaust(entity) {
    if (entity.hasComponent("ShipExhaustComponent")) {
      if (!this.exhaustEntities.has(entity)) {
        let exhaustComponent = entity.getComponent("ShipExhaustComponent");
        let emitter = game.add.emitter(100, 700, 200);
        emitter.makeParticles("pixelWhite", 0, 200, true);

        emitter.start(false, 200, 10);
        emitter.setScale(6, 1, 6, 1, 600);
        emitter.setAlpha(0.8, 0.2, 300);
        // emitter.emitY = 20;
        // emitter.maxParticleScale = 4;
        emitter.maxParticleSpeed.x = 5;
        emitter.maxParticleSpeed.y = 5;
        emitter.minParticleSpeed.x = -5;
        emitter.minParticleSpeed.y = -5;
        emitter.lifespan = 1000;
        emitter.frequency = 1;
        // emitter.alpha = 0.5;
        // emitter.makeParticles = 1000;
        emitter.gravity.y = 0;
        emitter.on = true;
        emitter.emitX = -24;
        this.exhaustEntities.set(entity, emitter);
      }
      entity.getComponent("ShipExhaustComponent").emitter =
        this.exhaustEntities.get(entity);
      this.refreshComponent(entity);
    }
  }

  refreshComponent(entity) {
    // console.log(entity);
    let sprite = entity.getComponent("SpriteComponent").sprite;
    let offSet = sprite.addChild(game.make.sprite(-12, 0, sprite.key));
    offSet.anchor.setTo(0.5, 0.5);
    offSet.alpha = 0;
    if (entity.hasComponent("TrackerComponent")) {
      entity.removeComponent("TrackerComponent");
    }
    entity.addComponent(
      new TrackerComponent(
        entity,
        entity.getComponent("ShipExhaustComponent").emitter,
        offSet
      )
    );
    // this.trackerComponent = entity.getComponent("TrackerComponent");
  }
}
