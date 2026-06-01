import { System } from "./System.js";

export class TrackerSystem extends System {
  constructor() {
    super();
    this.actors; // Populated by entity manager
    this.entities = this.entityManager.registerSystem(this, [
      "TrackerComponent",
    ]);
  }

  update() {
    this.entities.forEach((entity) => {
      const trackerComponent = entity.getComponent("TrackerComponent");
      trackerComponent.source.x =
        trackerComponent.target.body?.x + trackerComponent.target.width / 2 ||
        trackerComponent.target.world.x;
      trackerComponent.source.y =
        trackerComponent.target.body?.y + trackerComponent.target.height / 2 ||
        trackerComponent.target.world.y;
      // trackerComponent.source.x = trackerComponent.target.world.x;
      // trackerComponent.source.y = trackerComponent.target.world.y;
    });
  }
}
