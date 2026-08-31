import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class CollisionSystem extends System {
  constructor(renderer) {
    super();

    this.renderer = renderer;

    this.collisionEvents = [];

    this.debug = true;

    this.entities = this.entityManager.registerSystem(this, [
      "MovementComponent",
      "CollisionComponent",
    ]);

    this.movementList = resolveComponentList(
      "MovementComponent",
      this.entities,
    );

    this.collisionList = resolveComponentList(
      "CollisionComponent",
      this.entities,
    );

    // Non-ECS collision objects.
    // Projectiles can be added here directly.
    this.externalList = [];

    this.onCollision = null;
  }

  addExternal(object) {
    this.externalList.push(object);
  }

  removeExternal(object) {
    const index = this.externalList.indexOf(object);

    if (index !== -1) {
      this.externalList.splice(index, 1);
    }
  }

  update() {
    this.collisionEvents.length = 0;
    const movementList = this.movementList;
    const collisionList = this.collisionList;

    const len = collisionList.length;

    // ECS entity ↔ ECS entity
    for (let i = 0; i < len; i++) {
      const collision = collisionList[i];

      if (!collision.enabled) {
        continue;
      }

      const movement = movementList[i];

      if (!movement) {
        continue;
      }

      if (this.debug) {
        this.renderer.debugObjects.push({
          x: movement.x,
          y: movement.y,
          z: movement.z + collision.collisionOffsetZ,
          radius: collision.collisionRadius,
          height: collision.collisionHeight,
        });
      }

      //   console.log(collision);

      for (let j = i + 1; j < len; j++) {
        const otherCollision = collisionList[j];

        if (!otherCollision.enabled) {
          continue;
        }

        const otherMovement = movementList[j];

        if (!otherMovement) {
          continue;
        }

        if (this.overlaps(movement, collision, otherMovement, otherCollision)) {
          this.handleCollision(otherMovement.entity, movement.entity);
        }
      }
    }

    // ECS entity ↔ external object
    const externalList = this.externalList;
    const externalLen = externalList.length;
    // console.log(this.externalList);

    for (let i = 0; i < len; i++) {
      const collision = collisionList[i];

      if (!collision.enabled) {
        continue;
      }

      const movement = movementList[i];

      if (!movement) {
        continue;
      }

      for (let j = 0; j < externalLen; j++) {
        const external = externalList[j];

        if (!external.active) {
          continue;
        }
        if (external.entity === movement.entity) {
          continue;
        }
        if (this.debug) {
          this.renderer.debugObjects.push({
            x: external.x,
            y: external.y,
            z: external.z + external.collisionOffsetZ,
            radius: external.collisionRadius,
            height: external.collisionHeight,
          });
        }

        if (this.overlaps(movement, collision, external, external)) {
          // console.log(external);
          this.handleCollision(external, movement);
        }
      }
    }
  }

  overlaps(positionA, collisionA, positionB, collisionB) {
    const dx = positionA.x - positionB.x;
    const dy = positionA.y - positionB.y;

    const collisionRadius =
      collisionA.collisionRadius + collisionB.collisionRadius;

    const horizontalDistanceSquared = dx * dx + dy * dy;

    if (horizontalDistanceSquared > collisionRadius * collisionRadius) {
      return false;
    }

    const aBottom = positionA.z + collisionA.collisionOffsetZ;

    const aTop = aBottom + collisionA.collisionHeight;

    const bBottom = positionB.z + collisionB.collisionOffsetZ;

    const bTop = bBottom + collisionB.collisionHeight;

    return aBottom < bTop && aTop > bBottom;
  }

  handleCollision(source, target) {
    // console.log("Collision detected between", source, "and", target);
    this.collisionEvents.push({ source, target });
  }
}
