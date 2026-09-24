export class CellComponent {
  static editor = {
    fields: {
      cellId: { type: "string" },
      sectionId: { type: "number" },
    },
  };
  constructor(entity, data) {
    this.entity = entity;
    this.mutateBlocking = data.mutateBlocking ?? true;
    this.timeout = data.timeout ?? 2000;
    this.cellId = data.cellId ?? 0;
    this.sectionIndex = data.sectionId ?? 0;
    this.originalSections = null;
    this.originalBlocking = null;
  }
}
