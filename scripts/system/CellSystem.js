import { timerDelay } from "../services/TimerService.js";
import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class CellSystem extends System {
  constructor(raycaster) {
    super();
    this.raycaster = raycaster;
    this.entities = this.entityManager.registerSystem(this, ["CellComponent"]);
    this.cellComps = resolveComponentList("CellComponent", this.entities);
    this.cellComps.forEach((cell) => {
      const cellData = this.raycaster.getCellDefinition(cell.cellId);
      const renderedCell = this.raycaster.getCellById(cell.cellId);
      cell.originalSections = cellData.sections;
      cell.originalBlocking = renderedCell.blocking;
      console.log(cell);
    });
  }

  mutateCell(data) {
    // console.log(data.trigger);
    this.removeSection(data.trigger);
  }

  restoreCell(data) {
    this.restoreOriginalSection(data.trigger);
  }

  removeSection(entity) {
    const cellComponent = entity.getComponent("CellComponent");
    if (!cellComponent) return;
    const index = cellComponent.sectionIndex;

    const newSections = [];
    cellComponent.originalSections.forEach((section, idx) => {
      if (idx !== index) newSections.push(section);
    });

    this.raycaster.setCellSections(cellComponent.cellId, newSections);

    if (cellComponent.mutateBlocking) {
      this.raycaster.setCellBlocking(
        cellComponent.cellId,
        !cellComponent.originalBlocking,
      );
    }
  }

  restoreOriginalSection(entity) {
    const cellComponent = entity.getComponent("CellComponent");
    if (!cellComponent) return;
    this.raycaster.setCellSections(
      cellComponent.cellId,
      cellComponent.originalSections,
    );
    this.raycaster.setCellBlocking(
      cellComponent.cellId,
      cellComponent.originalBlocking,
    );
  }
}
