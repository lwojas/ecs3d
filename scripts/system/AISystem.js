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
// patrolling, omniscient hunting -- see HuntingComponent) come from
// whichever other components the entity also has -- this system never
// assumes an enemy/NPC split beyond AIComponent.disposition.
//
//   AISystem -> movement/facing intent -> MovementComponent -> MoveSystem/CollisionSystem
//   AISystem -> attack intent -> ItemSystem -> ProjectileSystem
//   AISystem -> animation intent -> SpriteComponent -> SpriteSystem -> Raycaster
export class AISystem extends System {
  constructor(raycaster, itemSystem, animationSystem) {
    super();
    this.raycaster = raycaster;
    this.itemSystem = itemSystem;
    this.animationSystem = animationSystem;

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

    this.refreshList();
  }

  // Re-derives every parallel component list from this.entities. Called on
  // construction and by EntityManager whenever the entity world changes
  // (see System.refreshList / EntityManager.updateEntityLists), so newly
  // spawned or removed AI entities stay in sync.
  refreshList() {
    this.actorRegistry = {};
    this.actorRegistry.entities = this.entityManager.registerSystem(
      this.actorRegistry,
      ["ActorComponent"],
    );
    this.actorList = resolveComponentList(
      "ActorComponent",
      this.actorRegistry.entities,
    );
    this.actorMovementList = resolveComponentList(
      "MovementComponent",
      this.actorRegistry.entities,
    );
    console.log("refreshing AI system");
    this.aiList = resolveComponentList("AIComponent", this.entities);
    this.movementList = resolveComponentList(
      "MovementComponent",
      this.entities,
    );
    this.spriteList = resolveComponentList("SpriteComponent", this.entities);
    this.itemList = resolveComponentList("ItemComponent", this.entities);
    this.patrolList = resolveComponentList("PatrolComponent", this.entities);
    this.huntingList = resolveComponentList("HuntingComponent", this.entities);
    this.actorSelfList = resolveComponentList("ActorComponent", this.entities);
    this.combatMovementList = resolveComponentList(
      "CombatMovementComponent",
      this.entities,
    );
    this.hitReactionList = resolveComponentList(
      "HitReactionComponent",
      this.entities,
    );
  }

  update(delta, ecs) {
    const aiList = this.aiList;
    const len = aiList.length;
    if (len === 0) return;

    // Rebuilt once per frame (not per AI entity) -- this is the candidate
    // pool every AI entity perceives against this tick. actorRegistry.entities
    // is kept current by EntityManager as the world changes, so this stays
    // cheap and correct without a bespoke refresh hook.
    // const actorEntities = this.actorRegistry.entities;

    // Nonsense moved to refresh lists

    const actorList = this.actorList;
    const actorMovementList = this.actorMovementList;

    for (let i = 0; i < len; i++) {
      const ai = aiList[i];
      if (!ai.enabled) continue;

      const movement = this.movementList[i];
      if (!movement) continue;

      const sprite = this.spriteList[i];
      const item = this.itemList[i];
      const patrol = this.patrolList[i];
      const hunting = this.huntingList[i];
      const selfActor = this.actorSelfList[i];
      const combatMovement = this.combatMovementList[i];
      const hitReaction = this.hitReactionList[i];

      ai.decisionTimer -= delta;
      if (ai.decisionTimer <= 0) {
        ai.decisionTimer = ai.decisionInterval;
        this.evaluatePerception(
          ai,
          movement,
          selfActor,
          actorList,
          actorMovementList,
          hunting,
          ecs,
        );
        this.decideState(ai, movement, item, patrol, ecs);
      }

      // Reactions are real-time, not decision-cadence -- ticked every
      // frame regardless of decisionTimer above. This only ever
      // interferes with how this frame's intent gets applied below; it
      // never touches ai.state, so decideState()'s own chase/attack/
      // patrol logic picks up exactly where it left off once a
      // flinch/stagger clears (see the module-level design note in
      // CombatSystem.applyHitReaction).
      const reactionState = this.tickHitReaction(hitReaction, delta);
      const knockbackActive = this.applyKnockback(hitReaction, movement, delta);

      if (!knockbackActive) {
        if (reactionState === "none") {
          this.applyMovementIntent(ai, movement, patrol, combatMovement, delta);
        } else {
          movement.moveX = 0;
          movement.moveY = 0;
        }
      }

      // Flinch still lets the entity track its target; stagger is the
      // "stronger" interruption and also halts turning.
      if (reactionState !== "stagger") {
        this.applyFacing(ai, movement, delta);
      }

      if (reactionState === "none") {
        this.applyAttack(ai, movement, item, ecs);
      }

      this.applySprite(ai, sprite);
    }
  }

  // Decays timer/recoveryTimer, resets staggerChainCount once fully
  // recovered, and returns the reaction currently in effect. Knockback
  // is ticked separately (applyKnockback) since it's an independent
  // mechanic -- a hit can knock back without flinching/staggering.
  tickHitReaction(hitReaction, delta) {
    if (!hitReaction) return "none";

    if (hitReaction.recoveryTimer > 0) {
      hitReaction.recoveryTimer -= delta;
      if (hitReaction.recoveryTimer <= 0) {
        hitReaction.recoveryTimer = 0;
        hitReaction.staggerChainCount = 0;
      }
    }

    if (hitReaction.state === "none") return "none";

    hitReaction.timer -= delta;
    if (hitReaction.timer > 0) return hitReaction.state;

    const expiredFrom = hitReaction.state;
    hitReaction.state = "none";
    hitReaction.timer = 0;
    if (expiredFrom === "stagger") {
      hitReaction.recoveryTimer = hitReaction.recoveryDuration;
    }
    return "none";
  }

  // Knockback overrides whatever movement intent this frame would
  // otherwise apply -- physical displacement happens regardless of
  // flinch/stagger, funneled through the same wall-safe moveX/moveY/
  // speed contract MovementSystem already enforces for every entity.
  // Returns whether it actually overrode movement this frame.
  applyKnockback(hitReaction, movement, delta) {
    if (!hitReaction) return false;

    const length = Math.hypot(hitReaction.knockbackX, hitReaction.knockbackY);
    if (length <= 0.05) {
      hitReaction.knockbackX = 0;
      hitReaction.knockbackY = 0;
      return false;
    }

    movement.moveX = hitReaction.knockbackX;
    movement.moveY = hitReaction.knockbackY;
    movement.speed = length;

    const decay = Math.max(0, 1 - hitReaction.knockbackDecay * delta);
    hitReaction.knockbackX *= decay;
    hitReaction.knockbackY *= decay;
    return true;
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
        {
          x: targetMovement.x,
          y: targetMovement.y,
          // targetMovement.z is the target's base/standing height -- lift
          // the LOS check to roughly eye level so a knee-high obstacle
          // doesn't block sight of a target standing behind it.
          z: targetMovement.z + this.raycaster.cameraHeight,
        },
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

  // Omniscient counterpart to findVisibleTarget() -- for a HuntingComponent
  // entity, "is there a hostile" is the only question; viewDistance,
  // fieldOfView and line of sight never gate it. Kept as its own method
  // (not a flag threaded through findVisibleTarget/canPerceive) so the
  // normal perception path stays exactly as readable as it was.
  findHuntTarget(ai, movement, selfActor, actorList, actorMovementList) {
    if (!selfActor) return null;

    if (PREFER_STICKY_TARGET) {
      const sticky = this.getStickyHuntTarget(ai, selfActor);
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

      bestDistanceSq = distanceSq;
      best = candidateMovement;
    }

    return best;
  }

  // Hunting's counterpart to getStickyTarget() -- same "keep the current
  // target rather than re-picking nearest every tick" rule, but without
  // the perceive gate: a hunting AI doesn't need line of sight/FOV/range
  // to know a hostile it already locked onto is still there.
  getStickyHuntTarget(ai, selfActor) {
    const targetEntity = ai.targetEntity;
    if (!targetEntity || !targetEntity.isEnabled) return null;

    const candidateActor = targetEntity.getComponent("ActorComponent");
    const candidateMovement = targetEntity.getComponent("MovementComponent");
    if (!candidateActor || !candidateMovement) return null;
    if (!this.isHostile(selfActor, candidateActor)) return null;

    return candidateMovement;
  }

  evaluatePerception(
    ai,
    movement,
    selfActor,
    actorList,
    actorMovementList,
    hunting,
    ecs,
  ) {
    if (ai.disposition !== "enemy") {
      if (ai.isAware) this.loseAwareness(ai, movement, ecs);
      return;
    }

    const target = hunting
      ? this.findHuntTarget(
          ai,
          movement,
          selfActor,
          actorList,
          actorMovementList,
        )
      : this.findVisibleTarget(
          ai,
          movement,
          selfActor,
          actorList,
          actorMovementList,
        );

    if (target) {
      if (!target.enabled) return;
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
      const canAttack =
        item &&
        distance <= ai.attackRadius &&
        this.hasLineOfSightToTarget(ai, movement);
      nextState = canAttack ? "attack" : "chase";
    } else {
      nextState = patrol ? "patrol" : "idle";
    }

    ai.state = nextState;

    if (nextState !== previousState && nextState === "attack") {
      this.emitMessage(ecs, "ai.attack.started", movement);
    }
  }

  // Additional gate on top of distance for entering "attack" -- without
  // this, HuntingComponent's omniscient tracking (or a normal AI's
  // awarenessMemory keeping isAware true after LOS breaks) lets an
  // enemy fire blind through a wall it can't actually see the target
  // through. HuntingComponent's own bypass of LOS/FOV for *finding*/
  // chasing a target is untouched -- this only gates whether it's
  // allowed to shoot this decision tick.
  hasLineOfSightToTarget(ai, movement) {
    const targetMovement = this.getTargetMovement(ai);
    if (!targetMovement) return false;

    return this.raycaster.checkVisibility(
      { x: movement.x, y: movement.y, z: movement.z },
      {
        x: targetMovement.x,
        y: targetMovement.y,
        z: targetMovement.z + this.raycaster.cameraHeight,
      },
    ).visible;
  }

  applyMovementIntent(ai, movement, patrol, combatMovement, delta) {
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
        this.applyCombatMovement(movement, combatMovement, delta);
        break;
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

  // Without a CombatMovementComponent, an attacking entity just holds
  // position (the old behaviour). With one, it strafes perpendicular to
  // its current facing -- which applyFacing() keeps pointed at the
  // target -- so it reads as circling/repositioning rather than
  // drifting off at a random angle. strafeFrequency/phase are per-
  // entity so a room full of enemies doesn't strafe in lockstep.
  applyCombatMovement(movement, combatMovement, delta) {
    if (!combatMovement) {
      movement.moveX = 0;
      movement.moveY = 0;
      return;
    }

    combatMovement.elapsed += delta;

    const strafeX = -Math.sin(movement.angle);
    const strafeY = Math.cos(movement.angle);
    const wobble = Math.sin(
      combatMovement.elapsed * combatMovement.strafeFrequency * Math.PI * 2 +
        combatMovement.phase,
    );

    movement.moveX = strafeX * wobble;
    movement.moveY = strafeY * wobble;
    movement.speed = combatMovement.strafeSpeed;
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

    const equippedItem =
      movement.entity.getComponent("InventoryComponent")?.equipped;
    if (!equippedItem) return;

    this.itemSystem.useItem(equippedItem, movement.entity.id, movement, target);
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

    switch (ai.state) {
      case "attack":
        this.animationSystem.play(ai.entity, "enemyAttack");
        break;
      case "idle":
        this.animationSystem.play(ai.entity, "enemyIdle");
        break;
      default:
        this.animationSystem.play(ai.entity, "enemyWalk");
        break;
    }
  }

  emitMessage(ecs, type, movement, extra = {}) {
    if (!ecs) return;
    ecs.emit({ type, entityId: movement.entity.id, ...extra });
  }
}
