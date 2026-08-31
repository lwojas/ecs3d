export class TriggerComponent {
  constructor(entity, data = {}) {
    this.entity = entity;

    // Authored/serializable configuration.
    this.enabled = data.enabled ?? true;
    this.once = data.once ?? false;
    // [{ event: "lights.set", data: { ... } }, ...]. A list so one
    // trigger can fire several actions on entry. Deliberately generic --
    // TriggerSystem only ever reads `.event`/`.data` off each entry,
    // never interprets it. onExit/onStay aren't added as fields yet
    // (nothing needs them); TriggerSystem's enter/exit diffing already
    // computes exits as a side effect, so adding them later is one more
    // field here + one more branch there, not a redesign.
    this.onEnter = data.onEnter ?? [];

    // Runtime-only bookkeeping, never authored -- kept here (like
    // AIComponent.state, ItemComponent.nextFireTime) rather than as
    // separate TriggerSystem-side bookkeeping that would need manual
    // cleanup when a trigger entity is removed.
    this.hasFired = false; // for `once`: has this trigger fired at all yet
    this.activeEntities = new Set(); // who's currently considered "inside" it
    this.currentEntities = new Set();
    this.ignoredTypes = data.ignoredTypes || ["enemy"];
  }
}
