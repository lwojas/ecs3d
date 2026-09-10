// Presence-only gate: an AI with this attached always knows the nearest
// hostile actor's position, bypassing AIComponent's viewDistance/
// fieldOfView/line-of-sight checks entirely (see AISystem.findHuntTarget).
// Composes with AIComponent the same way PatrolComponent does -- nothing
// else in AISystem changes because of it.
export class HuntingComponent {
  static editor = {
    fields: {},
  };

  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;
  }
}
