export class TriggerComponent {
  static editor = {
    fields: {
      enabled: { type: "boolean" },
      once: { type: "boolean" },
      onEnter: { type: "array" },
      onExit: { type: "array" },
      ignoredTypes: { type: "array" },
    },
  };

  constructor(entity, data = {}) {
    this.entity = entity;

    // Authored/serializable configuration.
    this.enabled = data.enabled ?? true;
    this.once = data.once ?? false;
    // [{ event: "lights.set" }, ...]. A list so one trigger can fire
    // several actions on entry. Deliberately generic -- TriggerSystem
    // only ever reads `.event` off each entry and emits it with the
    // complete trigger/activator entities, never any per-action payload;
    // whatever system listens for that event takes ownership from there
    // and decides what to do with those entities. onExit/onStay aren't
    // added as fields yet (nothing needs them); TriggerSystem's
    // enter/exit diffing already computes exits as a side effect, so
    // adding them later is one more field here + one more branch there,
    // not a redesign.
    this.onEnter = data.onEnter ?? [];
    this.onExit = data.onExit ?? [];
    this.ignoredTypes = data.ignoredTypes || ["enemy"];

    // Runtime-only bookkeeping, never authored -- kept here (like
    // AIComponent.state, ItemComponent.nextFireTime) rather than as
    // separate TriggerSystem-side bookkeeping that would need manual
    // cleanup when a trigger entity is removed.
    this.hasFired = false; // for `once`: has this trigger fired at all yet
    this.activeEntities = new Set(); // who's currently considered "inside" it
    this.currentEntities = new Set();
  }
}
