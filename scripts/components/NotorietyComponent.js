export class NotorietyComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.notoriety = { friend: data.friend || 0, foe: data.foe || 0 };
  }
}
