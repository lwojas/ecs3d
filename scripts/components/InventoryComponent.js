export class InventoryComponent {
  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;

    // What this entity currently owns/has equipped *for this map/
    // session*. Persistent player inventory lives on User.state.inventory
    // instead -- GameSession is the only place that copies between the
    // two, and only at session/map start (see GameSession.js). This
    // component knows nothing about GameplayManager or how that copy
    // happens.
    this.items = [...(data.items ?? [])];
    this.equipped = data.equipped ?? null;

    // Reserved for future ammo/resource tracking (e.g. { pistolAmmo: 12 }).
    // Deliberately unused today -- belongs here (owned-by-the-player
    // state), not in itemData.js's static item definitions ("what a
    // pistol is" vs "how much ammo this player has").
    this.resources = { ...(data.resources ?? {}) };
  }
}
