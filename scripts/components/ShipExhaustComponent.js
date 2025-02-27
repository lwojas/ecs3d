import { TrackerComponent } from "./tags/TrackerComponent.js";

export class ShipExhaustComponent {
  constructor(entity) {
    this.emitter = game.add.emitter(0, 0, 200);
    this.emitter.makeParticles("pixelWhite", 0, 200, true);

    this.emitter.start(false, 200, 10);
    this.emitter.setScale(6, 1, 6, 1, 600);
    this.emitter.setAlpha(0.8, 0.2, 300);
    // this.emitter.emitY = 20;
    // this.emitter.maxParticleScale = 4;
    this.emitter.maxParticleSpeed.x = 5;
    this.emitter.maxParticleSpeed.y = 5;
    this.emitter.minParticleSpeed.x = -5;
    this.emitter.minParticleSpeed.y = -5;
    this.emitter.lifespan = 1000;
    this.emitter.frequency = 1;
    // this.emitter.alpha = 0.5;
    // this.emitter.makeParticles = 1000;
    this.emitter.gravity.y = 0;
    this.emitter.on = true;
    this.emitter.emitX = -24;

    this.refreshComponent(entity);
  }
  refreshComponent(entity) {
    let sprite = entity.getComponent("SpriteComponent").sprite;
    let offSet = sprite.addChild(game.make.sprite(-12, 0, sprite.key));
    offSet.anchor.setTo(0.5, 0.5);
    offSet.alpha = 0;
    if (this.trackerComponent) {
      entity.removeComponent("TrackerComponent");
    }
    entity.addComponent(new TrackerComponent(entity, this.emitter, offSet));
    this.trackerComponent = entity.getComponent("TrackerComponent");
  }
}
