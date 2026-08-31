export class ResourceComponent {
  constructor(entity, data) {
    this.entity = entity;
    this.resources = data || { plasma: 150 };
  }
}
