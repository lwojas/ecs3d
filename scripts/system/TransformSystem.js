import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class TransformSystem extends System {
  constructor() {
    super();
    this.entities = this.entityManager.registerSystem(this, [
      "TransformComponent",
    ]);
    this.transformList = resolveComponentList(
      "TransformComponent",
      this.entities,
    );
    this.spriteList = resolveComponentList("SpriteComponent", this.entities);
  }
  update(delta) {
    // const delta = game.time.now;
    // console.log(this.entities);
    const len = this.entities.length;

    for (let i = 0; i < len; i++) {
      const transform = this.transformList[i];
      const sprite = this.spriteList[i];
      //   console.log(transform, sprite);
      if (!transform || !sprite || !sprite.enabled) continue;

      transform.elapsed += delta;

      const rotate = transform.transformations.rotate;
      //   console.log(rotate);

      if (rotate) {
        sprite.angle += rotate.z * delta;
      }
    }
  }
}
