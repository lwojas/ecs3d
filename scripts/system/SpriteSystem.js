import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class SpriteSystem extends System {
  constructor(cameraRenderer) {
    super();
    this.entities = this.entityManager.registerSystem(this, [
      "SpriteComponent",
    ]);
    this.componentList = resolveComponentList("SpriteComponent", this.entities);
    this.movementList = resolveComponentList(
      "MovementComponent",
      this.entities,
    );
    this.renderList = cameraRenderer.sprites;
  }

  update() {
    // this.renderList.length = 0;
    const len = this.componentList.length;
    for (let i = 0; i < len; i++) {
      const sprite = this.componentList[i];
      if (!sprite.enabled) continue;
      const movement = this.movementList[i];
      if (movement) {
        sprite.x = movement.x;
        sprite.y = movement.y;
        sprite.z = movement.z;
      }
      this.renderList.push(sprite);
    }
  }
}
