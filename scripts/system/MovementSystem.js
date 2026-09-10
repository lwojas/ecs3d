import { resolveComponentList } from "../tools/componentResolver.js";

import { System } from "./System.js";

export class MovementSystem extends System {
  constructor(raycaster) {
    super();

    this.raycaster = raycaster;
    this.componentList = [];
    this.entities = this.entityManager.registerSystem(this, [
      "MovementComponent",
    ]);

    this.refreshList();

    // How close a section bottom must be to the entity's current
    // standing height to be considered the surface the entity is on.
    this.heightEpsilon = 0.01;
  }

  refreshList() {
    const components = resolveComponentList("MovementComponent", this.entities);

    this.componentList.length = 0;

    for (let i = 0, len = components.length; i < len; i++) {
      const component = components[i];

      if (component.movable) {
        this.componentList.push(component);
      }
    }
  }

  update(delta, ecs) {
    const dt = delta;
    const len = this.componentList.length;

    for (let i = 0; i < len; i++) {
      const target = this.componentList[i];

      if (!target.enabled) continue;

      let moveX = target.moveX;
      let moveY = target.moveY;

      const length = Math.sqrt(moveX * moveX + moveY * moveY);

      if (length > 0) {
        moveX /= length;
        moveY /= length;

        const distance = target.speed * dt;

        const nextX = target.x + moveX * distance;
        const nextY = target.y + moveY * distance;

        if (!this.raycaster.isWallWorld(nextX, target.y)) {
          target.x = nextX;
        }

        if (!this.raycaster.isWallWorld(target.x, nextY)) {
          target.y = nextY;
        }
      }

      this.updateVerticalPosition(target, dt);
    }
  }

  // target.z is always the entity's physical base/standing height -- for
  // every movable entity, player or NPC alike. Rendering-only concerns
  // (e.g. the camera's eye-height offset) are layered on top of this by
  // whoever renders the entity; they must never feed back into it.
  updateVerticalPosition(target, dt) {
    const groundHeight = this.resolveStandingHeight(
      target.x,
      target.y,
      target.z,
    );

    if (target.z <= groundHeight + this.heightEpsilon) {
      // On (or below) the ground -- snap up instantly. This is what makes
      // stairs/ledges feel immediate rather than climbed.
      target.z = groundHeight;
      target.verticalVelocity = 0;
    } else {
      // Above the ground -- falling. Let gravity carry it down instead of
      // teleporting to groundHeight in one frame.
      target.verticalVelocity -= target.gravity * dt;
      target.z += target.verticalVelocity * dt;

      if (target.z < groundHeight) {
        target.z = groundHeight;
        target.verticalVelocity = 0;
      }
    }
  }

  resolveStandingHeight(x, y, currentHeight) {
    const cell = this.raycaster.getCell(
      x / this.raycaster.cellSize,
      y / this.raycaster.cellSize,
    );

    if (!cell) return 0;

    const floorHeight = cell.floorHeight ?? 0;
    const sections = cell.sections ?? [];

    let standingHeight = floorHeight;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // A section can only support us if its bottom is at or below
      // our current standing height. Sections above us are overhead
      // geometry and must not cause us to jump onto them.
      if (section.bottom <= currentHeight + this.heightEpsilon) {
        standingHeight = Math.max(standingHeight, section.top);
      }
    }

    return standingHeight;
  }

  sendMessage(component, ecs) {
    ecs.emit({
      type: "entity.moving",
      playerId: "null",
    });
  }
}
