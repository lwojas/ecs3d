import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class CombatSystem extends System {
  constructor(ecs, hud, collisionEvents, bloodSplat) {
    super();
    this.collisionEvents = collisionEvents;
    this.messageQueue = ecs;
    this.bloodSplat = bloodSplat;
    this.hud = hud;

    this.entities = this.entityManager.registerSystem(this, [
      "HealthComponent",
    ]);
    this.refreshList();
  }

  refreshList() {
    this.componentList = resolveComponentList("HealthComponent", this.entities);
  }

  applyDamage(target, source) {
    const health = this.getHealth(target);
    if (!health) {
      return false;
    }

    if (health.invulnerable) {
      return false;
    }
    const previousHealth = health.current;
    health.current = Math.max(0, health.current - source.damage);

    this.messageQueue.emit({
      type: "entity.damaged",
      target,
      source,
      previousHealth,
      currentHealth: health.current,
    });

    if (previousHealth > 0 && health.current <= 0) {
      this.messageQueue.emit({
        type: "entity.killed",
        target,
        source,
      });
    } else {
      // Reactions are a live-target-only concern -- a killing blow just
      // dies, it doesn't also flinch/stagger/knock back.
      this.applyHitReaction(target.entity, source);
    }

    // HUD health display is player-specific -- most damaged targets
    // (enemies) have no HudComponent, but the hit still happened and
    // callers (update(), below) still need to know that to trigger
    // blood splat / deactivate the projectile.
    if (target.entity.hasComponent("HudComponent")) {
      this.hud.setHealth(health.current);
    }

    return true;
  }

  // Decides *what* reaction a hit produces and writes it onto the
  // target's HitReactionComponent -- AISystem is the one that decides
  // how that state actually interferes with movement/facing/attack this
  // frame (see AISystem.tickHitReaction). Knockback and flinch/stagger
  // are independent: a hit can carry either, both, or neither.
  applyHitReaction(entity, source) {
    const reaction = entity.getComponent("HitReactionComponent");
    if (!reaction || !reaction.enabled) return;

    const knockback = source.knockback ?? 0;
    if (knockback > 0) {
      const movement = entity.getComponent("MovementComponent");
      const dx = movement.x - source.x;
      const dy = movement.y - source.y;
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      reaction.knockbackX = (dx / length) * knockback;
      reaction.knockbackY = (dy / length) * knockback;
    }

    const staggerPower = source.staggerPower ?? 0;
    if (staggerPower <= 0) return; // damage-only hit -- not every hit reacts

    const canStagger =
      staggerPower >= reaction.staggerThreshold && reaction.recoveryTimer <= 0;

    if (canStagger) {
      // Refresh/extend on every qualifying hit -- lets a weapon pin a
      // susceptible enemy -- but diminishing per consecutive stagger
      // (reset once recoveryTimer fully elapses) stops that being an
      // infinite stun-lock.
      const duration = Math.max(
        reaction.minStaggerDuration,
        reaction.staggerDuration *
          Math.pow(reaction.diminishingFactor, reaction.staggerChainCount),
      );
      reaction.staggerChainCount += 1;
      reaction.state = "stagger";
      reaction.timer = duration;
    } else if (reaction.state !== "stagger") {
      // A weak hit never downgrades an active stagger -- it just keeps
      // dealing damage underneath it.
      reaction.state = "flinch";
      reaction.timer = Math.max(reaction.timer, reaction.flinchDuration);
    }
  }

  heal(target, amount, options = {}) {
    const health = this.getHealth(target);

    if (!health) {
      return false;
    }

    const previousHealth = health.current;

    health.current = Math.min(health.maximum, health.current + amount);

    if (health.current !== previousHealth) {
      this.messageQueue.emit({
        type: "entity.healed",
        target,
        amount: health.current - previousHealth,
        previousHealth,
        currentHealth: health.current,
        source: options.source ?? null,
      });
    }

    return true;
  }

  getHealth(target) {
    return target.entity.getComponent("HealthComponent");
  }

  update(delta) {
    const len = this.collisionEvents.length;
    for (let i = 0; i < len; i++) {
      const event = this.collisionEvents[i];

      // CollisionSystem builds every event for the frame before this
      // loop runs, so a projectile overlapping several targets at once
      // (e.g. enemies clustered together) produces one event per
      // target. Once it's already dealt its hit earlier in this same
      // batch, later events still referencing it (now inactive) must be
      // skipped -- otherwise one shot damages everyone it touched.
      if (event.source.active === false) continue;

      const friendly = this.checkFriendlyFire(event.source, event.target);
      if (event.source.damage && !friendly) {
        const hit = this.applyDamage(event.target, event.source);
        // Needs decoupling from Prjectile
        if (hit && event.source.constructor.name === "Projectile") {
          this.bloodSplat.spawn({
            x: event.source.x,
            y: event.source.y,
            z: event.source.z,
          });
          event.source.active = false;
        }
      }
    }
  }

  checkFriendlyFire(source, target) {
    const sourceTeam = source.entity?.getComponent("ActorComponent")?.team;
    const targetTeam = target.entity?.getComponent("ActorComponent")?.team;
    if (sourceTeam === targetTeam) return true;
  }
}
