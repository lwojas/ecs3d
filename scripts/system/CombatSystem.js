import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class CombatSystem extends System {
  constructor(ecs, collisionEvents) {
    super();
    this.collisionEvents = collisionEvents;
    this.messageQueue = ecs;

    this.entities = this.entityManager.registerSystem(this, [
      "HealthComponent",
    ]);
    this.refreshList();
  }

  refreshList() {
    this.componentList = resolveComponentList("HealthComponent", this.entities);
  }

  applyDamage(target, amount, options = {}) {
    const health = this.getHealth(target);
    // console.log(health);

    if (!health) {
      return false;
    }

    if (health.invulnerable) {
      return false;
    }

    const previousHealth = health.current;

    health.current = Math.max(0, health.current - amount);

    this.messageQueue.emit({
      type: "entity.damaged",
      target,
      source: options.source ?? null,
      amount,
      previousHealth,
      currentHealth: health.current,
      damageType: options.damageType ?? null,
    });

    return true;
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
      const friendly = this.checkFriendlyFire(event.source, event.target);
      if (event.source.damage && !friendly) {
        // this.checkFriendlyFire(event.source, event.target);
        // console.log(event.source.constructor.name);
        const hit = this.applyDamage(event.target, event.source);
        if (hit && event.source.constructor.name === "Projectile")
          event.source.active = false;
      }
    }
  }

  checkFriendlyFire(source, target) {
    const sourceTeam = source.entity?.getComponent("ActorComponent")?.team;
    const targetTeam = target.entity?.getComponent("ActorComponent")?.team;
    if (sourceTeam === targetTeam) return true;
  }
}
