export class SpawnComponent {
  static editor = {
    fields: {
      point: { type: "string" },
      zone: { type: "string" },
    },
  };

  constructor(entity, data = {}) {
    this.entity = entity;
    this.enabled = true;

    // Authoring metadata only -- "where should this entity spawn/reset
    // to", not "where is it right now" (that's MovementComponent). A
    // named point, a named zone (a group of points), or both may be set;
    // EntitySpawner is the only thing that reads these.
    this.point = data.point || null;
    this.zone = data.zone || null;
  }
}
