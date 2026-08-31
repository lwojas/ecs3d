import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

function normalizeAngle(angle) {
  let normalized = angle % (Math.PI * 2);
  if (normalized > Math.PI) normalized -= Math.PI * 2;
  if (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function turnToward(current, target, maxStep) {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(diff) * maxStep);
}

// Once an AI has a target, keep it as long as it's still a valid, visible
// candidate rather than re-picking "nearest" every decision tick -- stops
// flicker between two hostiles that are both in view. A blanket behaviour
// of this system, not a per-AIComponent/level setting -- nothing so far
// has needed per-entity control over it.
const PREFER_STICKY_TARGET = true;

// Perceives, decides and moves any entity with an AIComponent +
// MovementComponent. Capabilities beyond that (attacking, animation,
// patrolling) come from whichever other components the entity also has --
// this system never assumes an enemy/NPC split beyond AIComponent.disposition.
//
//   AISystem -> movement/facing intent -> MovementComponent -> MoveSystem/CollisionSystem
//   AISystem -> attack intent -> ItemSystem -> ProjectileSystem
//   AISystem -> animation intent -> SpriteComponent -> SpriteSystem -> Raycaster
export class AISystem extends System {
  constructor(raycaster, itemSystem) {
    super();
    this.raycaster = raycaster;
    this.itemSystem = itemSystem;

    this.entities = this.entityManager.registerSystem(this, [
      "AIComponent",
      "MovementComponent",
    ]);

    // A second, independent registration for "everything that could ever
    // be a target" -- kept on its own plain object rather than `this`.
    // EntityManager.registerSystem keeps exactly one requiredComponents/
    // entities pair per system object it's given, so calling it twice on
    // `this` would have the second call silently overwrite the first
    // (this.entities would end up filtered by ActorComponent instead of
    // AIComponent+MovementComponent).
    this.actorRegistry = {};
    this.actorRegistry.entities = this.entityManager.registerSystem(
      this.actorRegistry,
      ["ActorComponent"],
    );

    this.refreshList();
  }

  // Re-derives every parallel component list from this.entities. Called on
  // construction and by EntityManager whenever the entity world changes
  // (see System.refreshList / EntityManager.updateEntityLists), so newly
  // spawned or removed AI entities stay in sync.
  refreshList() {
    this.aiList = resolveComponentList("AIComponent", this.entities);
    this.movementList = resolveComponentList(
      "MovementComponent",
      this.entities,
    );
    this.spriteList = resolveComponentList("SpriteComponent", this.entities);
    this.itemList = resolveComponentList("ItemComponent", this.entities);
    this.patrolList = resolveComponentList("PatrolComponent", this.entities);
    this.actorSelfList = resolveComponentList("ActorComponent", this.entities);
  }

  update(delta, ecs) {
    const aiList = this.aiList;
    const len = aiList.length;
    if (len === 0) return;

    // Rebuilt once per frame (not per AI entity) -- this is the candidate
    // pool every AI entity perceives against this tick. actorRegistry.entities
    // is kept current by EntityManager as the world changes, so this stays
    // cheap and correct without a bespoke refresh hook.
    const actorEntities = this.actorRegistry.entities;
    const actorList = resolveComponentList("ActorComponent", actorEntities);
    const actorMovementList = resolveComponentList(
      "MovementComponent",
      actorEntities,
    );

    for (let i = 0; i < len; i++) {
      const ai = aiList[i];
      if (!ai.enabled) continue;

      const movement = this.movementList[i];
      if (!movement) continue;

      const sprite = this.spriteList[i];
      const item = this.itemList[i];
      const patrol = this.patrolList[i];
      const selfActor = this.actorSelfList[i];

      ai.decisionTimer -= delta;
      if (ai.decisionTimer <= 0) {
        ai.decisionTimer = ai.decisionInterval;
        this.evaluatePerception(
          ai,
          movement,
          selfActor,
          actorList,
          actorMovementList,
          ecs,
        );
        this.decideState(ai, movement, item, patrol, ecs);
      }

      this.applyMovementIntent(ai, movement, patrol);
      this.applyFacing(ai, movement, delta);
      this.applyAttack(ai, movement, item, ecs);
      this.applySprite(ai, sprite);
    }
  }

  // Two independent, composable gates -- kept separate on purpose:
  //   disposition: is this AI the kind that fights at all?
  //   team:        is this *specific* candidate hostile to it?
  // Swapping team-based hostility for a real relationship layer later only
  // means changing isHostile(); nothing above it needs to know.
  isHostile(selfActor, otherActor) {
    if (!selfActor || !otherActor) return false;
    return otherActor.team !== selfActor.team;
  }

  isWithinFieldOfView(movement, dx, dy, fieldOfView) {
    const angleToTarget = Math.atan2(dy, dx);
    const facingDelta = normalizeAngle(angleToTarget - movement.angle);
    return Math.abs(facingDelta) <= fieldOfView / 2;
  }

  canPerceive(ai, movement, dx, dy, distance, targetMovement) {
    // Distance, then the NPC's own simulated facing (independent of the
    // raycaster's camera), then a real LOS query against the world --
    // cheapest checks first, LOS query only when it could actually matter.
    return (
      distance <= ai.viewDistance &&
      this.isWithinFieldOfView(movement, dx, dy, ai.fieldOfView) &&
      this.raycaster.checkVisibility(
        { x: movement.x, y: movement.y, z: movement.z },
        { x: targetMovement.x, y: targetMovement.y, z: targetMovement.z },
      ).visible
    );
  }

  // Scans the whole candidate pool and returns the nearest hostile actor
  // this AI can currently perceive, or null if none qualify. Perception is
  // evaluated per-candidate -- this is what makes multiple possible targets
  // work at all; picking "the" target before checking visibility (the old
  // single-target version) can't generalise to a group.
  findVisibleTarget(ai, movement, selfActor, actorList, actorMovementList) {
    if (!selfActor) return null;

    if (PREFER_STICKY_TARGET) {
      const sticky = this.getStickyTarget(ai, movement, selfActor);
      if (sticky) return sticky;
    }

    let best = null;
    let bestDistanceSq = Infinity;

    for (let i = 0; i < actorList.length; i++) {
      const candidateActor = actorList[i];
      const candidateMovement = actorMovementList[i];

      if (!candidateActor || !candidateMovement) continue;
      if (candidateActor.entity === movement.entity) continue;
      if (!this.isHostile(selfActor, candidateActor)) continue;

      const dx = candidateMovement.x - movement.x;
      const dy = candidateMovement.y - movement.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq >= bestDistanceSq) continue;

      const distance = Math.sqrt(distanceSq);
      if (
        !this.canPerceive(ai, movement, dx, dy, distance, candidateMovement)
      ) {
        continue;
      }

      bestDistanceSq = distanceSq;
      best = candidateMovement;
    }

    return best;
  }

  // Re-checks the AI's *current* target directly (by entity reference,
  // not by scanning actorList/actorMovementList) against the same
  // hostile+perceive rules findVisibleTarget() applies to everyone else.
  // Only ever returns the already-acquired target, or null -- it never
  // introduces a new one.
  getStickyTarget(ai, movement, selfActor) {
    const targetEntity = ai.targetEntity;
    if (!targetEntity || !targetEntity.isEnabled) return null;

    const candidateActor = targetEntity.getComponent("ActorComponent");
    const candidateMovement = targetEntity.getComponent("MovementComponent");
    if (!candidateActor || !candidateMovement) return null;
    if (!this.isHostile(selfActor, candidateActor)) return null;

    const dx = candidateMovement.x - movement.x;
    const dy = candidateMovement.y - movement.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (!this.canPerceive(ai, movement, dx, dy, distance, candidateMovement)) {
      return null;
    }

    return candidateMovement;
  }

  evaluatePerception(
    ai,
    movement,
    selfActor,
    actorList,
    actorMovementList,
    ecs,
  ) {
    if (ai.disposition !== "enemy") {
      if (ai.isAware) this.loseAwareness(ai, movement, ecs);
      return;
    }

    const target = this.findVisibleTarget(
      ai,
      movement,
      selfActor,
      actorList,
      actorMovementList,
    );

    if (target) {
      if (ai.targetEntity !== target.entity) {
        this.emitMessage(ecs, "ai.target.detected", movement, {
          targetId: target.entity.id,
        });
      }
      ai.isAware = true;
      ai.targetEntity = target.entity;
      ai.lastKnownTargetX = target.x;
      ai.lastKnownTargetY = target.y;
      ai.awarenessTimer = ai.awarenessMemory;
      return;
    }

    if (ai.isAware) {
      // Losing every visible target degrades awareness over
      // `awarenessMemory` seconds instead of dropping it instantly -- the
      // AI keeps heading for the last known position until memory runs out.
      ai.awarenessTimer -= ai.decisionInterval;
      if (ai.awarenessTimer <= 0) {
        this.loseAwareness(ai, movement, ecs);
      }
    }
  }

  loseAwareness(ai, movement, ecs) {
    ai.isAware = false;
    ai.targetEntity = null;
    this.emitMessage(ecs, "ai.target.lost", movement);
  }

  decideState(ai, movement, item, patrol, ecs) {
    const previousState = ai.state;
    let nextState;

    if (ai.isAware) {
      const dx = ai.lastKnownTargetX - movement.x;
      const dy = ai.lastKnownTargetY - movement.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      nextState = item && distance <= ai.attackRadius ? "attack" : "chase";
    } else {
      nextState = patrol ? "patrol" : "idle";
    }

    ai.state = nextState;

    if (nextState !== previousState && nextState === "attack") {
      this.emitMessage(ecs, "ai.attack.started", movement);
    }
  }

  applyMovementIntent(ai, movement, patrol) {
    switch (ai.state) {
      case "chase":
        this.moveToward(
          movement,
          ai.lastKnownTargetX,
          ai.lastKnownTargetY,
          ai.moveSpeed,
        );
        break;
      case "patrol":
        this.movePatrol(movement, patrol);
        break;
      case "attack":
      case "idle":
      default:
        movement.moveX = 0;
        movement.moveY = 0;
        break;
    }
  }

  // Direct, un-pathfound movement toward a point -- MovementComponent's
  // moveX/moveY is a direction vector that MoveSystem normalises and
  // advances, checking collision, so AISystem never touches position math.
  moveToward(movement, targetX, targetY, speed) {
    const dx = targetX - movement.x;
    const dy = targetY - movement.y;

    if (Math.sqrt(dx * dx + dy * dy) < 1) {
      movement.moveX = 0;
      movement.moveY = 0;
      return;
    }

    movement.moveX = dx;
    movement.moveY = dy;
    movement.speed = speed;
  }

  movePatrol(movement, patrol) {
    if (!patrol || !patrol.patrolPoints.length) {
      movement.moveX = 0;
      movement.moveY = 0;
      return;
    }

    const point = patrol.patrolPoints[patrol.currentPatrolIndex];
    const dx = point.x - movement.x;
    const dy = point.y - movement.y;

    if (Math.sqrt(dx * dx + dy * dy) < 2) {
      patrol.currentPatrolIndex =
        (patrol.currentPatrolIndex + 1) % patrol.patrolPoints.length;
      movement.moveX = 0;
      movement.moveY = 0;
      return;
    }

    movement.moveX = dx;
    movement.moveY = dy;
    movement.speed = patrol.speed;
  }

  // Rotation simulated here, entirely separate from the raycaster's camera
  // handling -- it just steers MovementComponent.angle, which
  // isWithinFieldOfView() above then reads back as "which way is this NPC
  // looking" for the next perception pass.
  applyFacing(ai, movement, delta) {
    let desiredAngle = movement.angle;

    if (ai.state === "chase" || ai.state === "attack") {
      desiredAngle = Math.atan2(
        ai.lastKnownTargetY - movement.y,
        ai.lastKnownTargetX - movement.x,
      );
    } else if (movement.moveX !== 0 || movement.moveY !== 0) {
      desiredAngle = Math.atan2(movement.moveY, movement.moveX);
    }

    movement.angle = turnToward(
      movement.angle,
      desiredAngle,
      ai.turnSpeed * delta,
    );
  }

  // Weapon use emerges purely from composition: an AI entity only attacks
  // if it also carries an ItemComponent (the "can use items at all" gate,
  // checked above and in decideState()), and firing goes through the
  // same ItemSystem/ProjectileSystem path the player uses. Which item is
  // actually fired comes from InventoryComponent, not ItemComponent --
  // the same source InteractionSystem reads for the player.
  applyAttack(ai, movement, item, ecs) {
    if (ai.state !== "attack" || !item || !this.itemSystem) return;

    const target = this.getTargetMovement(ai);
    if (!target) return;

    const equippedItem = movement.entity.getComponent("InventoryComponent")?.equipped;
    if (!equippedItem) return;

    this.itemSystem.useItem(
      equippedItem,
      movement.entity.id,
      movement,
      target,
    );
  }

  // Fires at the target entity's *live* position, not the AI's last-known
  // memory of it -- lastKnownTargetX/Y is only for moving toward a target
  // that's currently out of sight.
  getTargetMovement(ai) {
    return ai.targetEntity
      ? ai.targetEntity.getComponent("MovementComponent")
      : null;
  }

  // Sets animation *intent* only -- SpriteSystem/Raycaster still own how
  // (or whether) that's actually rendered.
  applySprite(ai, sprite) {
    if (!sprite) return;

    sprite.animationState =
      ai.state === "attack"
        ? "attacking"
        : ai.state === "idle"
          ? "idle"
          : "walking";
  }

  emitMessage(ecs, type, movement, extra = {}) {
    if (!ecs) return;
    ecs.emit({ type, entityId: movement.entity.id, ...extra });
  }
}
