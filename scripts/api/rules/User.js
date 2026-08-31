export class User {
  constructor({ id, name = null, state = {} }) {
    if (!id) {
      throw new Error("User requires an id");
    }

    this.id = id;
    this.name = name;

    // Persistent/user-facing state.
    // Keep this deliberately open-ended for now.
    this.state = { ...state };

    // Runtime ECS representation.
    // null means the player currently has no entity.
    this.entityId = null;
  }

  bindEntity(entityId) {
    this.entityId = entityId;
  }

  unbindEntity() {
    this.entityId = null;
  }

  hasEntity() {
    return this.entityId !== null;
  }

  getState() {
    return { ...this.state };
  }

  setState(values) {
    Object.assign(this.state, values);
  }
}
