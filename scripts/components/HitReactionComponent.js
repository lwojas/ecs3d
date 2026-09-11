// Flinch/stagger/knockback tuning + live state for one entity. Owned by
// CombatSystem (it decides *what* reaction a hit produces and writes the
// state here -- see CombatSystem.applyHitReaction), read by AISystem
// (it decides *how* that state interferes with movement/facing/attack
// this frame -- see AISystem.tickHitReaction). Damage itself is never
// gated by this component; it's a purely additive behavioural layer.
export class HitReactionComponent {
  static editor = {
    fields: {
      staggerThreshold: { type: "number" },
      staggerDuration: { type: "number" },
      flinchDuration: { type: "number" },
      minStaggerDuration: { type: "number" },
      diminishingFactor: { type: "number" },
      recoveryDuration: { type: "number" },
      knockbackDecay: { type: "number" },
    },
  };

  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;

    // Minimum incoming source.staggerPower needed to stagger rather than
    // merely flinch -- the "weapon/enemy combination" axis; different
    // enemy templates set this differently (see componentDefaults.json).
    this.staggerThreshold = data.staggerThreshold ?? 8;

    // Seconds a full-strength stagger/flinch lasts.
    this.staggerDuration = data.staggerDuration ?? 0.5;
    this.flinchDuration = data.flinchDuration ?? 0.15;

    // Anti-stunlock: repeated staggers before a full recovery get
    // progressively shorter (diminishingFactor^staggerChainCount), down
    // to this floor -- lets a weapon pin a susceptible enemy without
    // ever fully locking it out of acting again.
    this.minStaggerDuration = data.minStaggerDuration ?? 0.2;
    this.diminishingFactor = data.diminishingFactor ?? 0.6;

    // Seconds after a stagger ends during which a new qualifying hit is
    // downgraded to a flinch instead of re-staggering. Once this fully
    // elapses, staggerChainCount resets and the next stagger is back to
    // full duration.
    this.recoveryDuration = data.recoveryDuration ?? 0.6;

    // Damping applied to the knockback vector per second (see
    // AISystem.tickHitReaction): factor = max(0, 1 - knockbackDecay * dt).
    this.knockbackDecay = data.knockbackDecay ?? 6;

    // Runtime state only.
    this.state = "none"; // "none" | "flinch" | "stagger"
    this.timer = 0;
    this.recoveryTimer = 0;
    this.staggerChainCount = 0;
    this.knockbackX = 0;
    this.knockbackY = 0;
  }
}
