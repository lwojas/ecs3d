import { ServiceLocator } from "../services/ServiceLocator.js";
import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

// Interprets trigger volumes and emits their configured action --
// nothing more. It never knows what "lights.set" or any other event
// means; that's EventRouter's job (see scripts/services/EventRouter.js).
// Reads CollisionSystem's existing collisionEvents (same pattern
// CombatSystem already uses for the same array) rather than running a
// second overlap check.

export class TriggerSystem extends System {
  constructor(collisionEvents) {
    super();

    this.collisionEvents = collisionEvents;

    this.eventBus = ServiceLocator.resolve("game", "EventSystem");

    this.entities = this.entityManager.registerSystem(this, [
      "TriggerComponent",
    ]);

    this.triggerList = resolveComponentList("TriggerComponent", this.entities);
  }

  update() {
    const len = this.triggerList.length;

    if (len === 0) return;

    // Clear the reusable current-frame sets.
    for (let i = 0; i < len; i++) {
      this.triggerList[i].currentEntities.clear();
    }

    // Build current overlaps.
    for (const event of this.collisionEvents) {
      this.recordCollision(event.source, event.target);
      this.recordCollision(event.target, event.source);
    }

    // Compare current frame against previous frame.
    for (let i = 0; i < len; i++) {
      const trigger = this.triggerList[i];

      if (!trigger.enabled) continue;

      const triggerEntity = this.entities[i];

      const current = trigger.currentEntities;
      const previous = trigger.activeEntities;
      // console.log(current);

      for (const activator of current) {
        if (!previous.has(activator)) {
          // const activator = this.entityManager.getEntity(activatorId);
          // const activator = current[activatorId];

          if (activator) {
            this.handleEnter(trigger, triggerEntity, activator);
          }
        }
      }

      // Swap reusable sets.
      trigger.activeEntities = current;
      trigger.currentEntities = previous;
    }
  }

  recordCollision(maybeTrigger, other) {
    if (!this.isEntity(maybeTrigger)) return;
    if (!this.isEntity(other)) return;

    const trigger = maybeTrigger.getComponent("TriggerComponent");

    if (!trigger) return;

    const actorTeam = other.getComponent("ActorComponent")?.team;
    if (!actorTeam) return;

    const filterList = trigger.ignoredTypes;

    for (let filter of filterList) {
      if (filter === actorTeam) return;
    }

    trigger.currentEntities.add(other);
  }

  isEntity(candidate) {
    return !!candidate && typeof candidate.hasComponent === "function";
  }

  handleEnter(trigger, triggerEntity, activator) {
    // if (trigger.once && trigger.hasFired) return;

    // trigger.hasFired = true;
    if (trigger.once) trigger.enabled = false;

    for (const action of trigger.onEnter) {
      if (!action?.event) continue;

      this.eventBus.emit(action.event, {
        trigger: triggerEntity,
        activator,
      });
    }
  }
}
