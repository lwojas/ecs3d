export class CellComponent {
  static editor = {
    fields: {
      cellId: { type: "string" },
    },
  };
  constructor(entity, data) {
    this.entity = entity;
    this.cellId = data.cellId ?? 0;
    this.originalSections = null;
    this.originalBlocking = null;
  }
}
