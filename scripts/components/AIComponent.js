export class AIComponent {
  static editor = {
    fields: {
      disposition: { type: "string" },
      viewDistance: { type: "number" },
      fieldOfView: { type: "number" },
      attackRadius: { type: "number" },
      turnSpeed: { type: "number" },
      awarenessMemory: { type: "number" },
      decisionInterval: { type: "number" },
      moveSpeed: { type: "number" },
    },
  };

  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;

    // "enemy" perceives and engages a target; "friendly" never does. This
    // keeps hostile/neutral behaviour data-driven without a full
    // faction/relationship system -- swapping in real target selection
    // later only means changing AISystem.resolveTarget().
    this.disposition = data.disposition || "enemy";

    // idle | patrol | chase | attack. "patrol" only ever gets chosen when
    // the entity also has a PatrolComponent. Adding a state later (flee,
    // investigate, search) means adding a case in AISystem's decideState()
    // and applyMovementIntent(), not restructuring this component.
    this.state = "idle";

    // Awareness
    this.viewDistance = data.viewDistance ?? 80;
    this.fieldOfView = data.fieldOfView ?? Math.PI / 2;
    this.attackRadius = data.attackRadius ?? 30;

    // How fast the entity's facing (MovementComponent.angle) turns to face
    // its target/movement direction, radians/second.
    this.turnSpeed = data.turnSpeed ?? Math.PI;

    this.isAware = false;
    this.targetEntity = null;
    this.lastKnownTargetX = null;
    this.lastKnownTargetY = null;

    // How long awareness persists after losing line of sight, in seconds,
    // before falling back to idle/patrol.
    this.awarenessMemory = data.awarenessMemory ?? 2;
    this.awarenessTimer = 0;

    // Perception/state decisions run on this interval; movement, facing
    // and attacking still update every frame off the last decision.
    this.decisionInterval = data.decisionInterval ?? 0.25;
    this.decisionTimer = 0;

    this.moveSpeed = data.moveSpeed ?? 6;
  }
}
