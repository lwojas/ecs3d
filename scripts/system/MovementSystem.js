import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class MovementSystem extends System {
  constructor(raycaster) {
    super();
    this.raycaster = raycaster;
    this.entities = this.entityManager.registerSystem(this, [
      "MovementComponent",
    ]);
    this.componentList = resolveComponentList(
      "MovementComponent",
      this.entities,
    );
  }

  update(delta, ecs) {
    const dt = delta;
    const len = this.componentList.length;
    for (let i = 0; i < len; i++) {
      const target = this.componentList[i];
      if (!target.enabled) continue;
      let moveX = target.moveX;
      let moveY = target.moveY;
      let length = Math.sqrt(moveX * moveX + moveY * moveY);

      if (length > 0) {
        moveX /= length;
        moveY /= length;

        const distance = target.speed * dt;

        const nextX = target.x + moveX * distance;

        const nextY = target.y + moveY * distance;

        if (!this.raycaster.isWallWorld(nextX, target.y)) {
          target.x = nextX;
          // this.sendMessage(target, ecs);
        }

        if (!this.raycaster.isWallWorld(target.x, nextY)) {
          target.y = nextY;
          // this.sendMessage(target, ecs);
        }
      }
    }
  }

  sendMessage(component, ecs) {
    ecs.emit({
      type: "entity.moving",
      playerId: "null",
    });
  }
}
