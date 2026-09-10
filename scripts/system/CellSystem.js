import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class CellSystem extends System {
  constructor(raycaster) {
    super();
    this.raycaster = raycaster;
    this.entities = this.entityManager.registerSystem(this, ["CellComponent"]);
    this.cellComps = resolveComponentList("CellComponent", this.entities);
    this.cellComps.forEach((cell) => {
      const cellData = this.raycaster.getCellById(cell.cellId);
      //   console.log(cellData.sections);

      cell.originalSections = cellData.sections;
      cell.originalBlocking = cellData.blocking;
      //   console.log(cell);
    });
  }

  removeSection(entity, index) {
    const cellComponent = entity.getComponent("CellComponent");
    if (!cellComponent) return;
    const newSections = cellComponent.sections.map((section, idx) => {
      if (idx !== index) return section;
    });
    this.raycaster.setCellSections(cellComponent.cellId);
  }
}
