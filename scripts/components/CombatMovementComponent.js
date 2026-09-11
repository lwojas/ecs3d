// Per-enemy-type "how do I move while attacking" data. Purely additive --
// composed the same way PatrolComponent/HuntingComponent are, so an
// AIComponent entity without this keeps AISystem's old frozen-while-
// attacking behaviour (see AISystem.applyMovementIntent's "attack" case).
export class CombatMovementComponent {
  static editor = {
    fields: {
      strafeSpeed: { type: "number" },
      strafeFrequency: { type: "number" },
    },
  };

  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;

    // Units/second of lateral strafe while attacking.
    this.strafeSpeed = data.strafeSpeed ?? 2.5;

    // How often (Hz) the strafe direction oscillates -- higher reads as
    // more erratic/aggressive, lower as a slow side-step.
    this.strafeFrequency = data.strafeFrequency ?? 0.5;

    // Runtime only. elapsed accumulates while in "attack" state (see
    // AISystem.applyCombatMovement); phase is randomised per-instance so
    // a room full of enemies doesn't strafe in lockstep.
    this.elapsed = 0;
    this.phase = Math.random() * Math.PI * 2;
  }
}
