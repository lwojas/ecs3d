import React from "react";

const MAX_SIZE = 220;

function clampPct(v) {
  return Math.min(100, Math.max(0, v));
}

// A tiny top-down reference of the loaded map, showing only the currently
// selected entity (rendering every entity would get noisy fast -- see the
// project brief). Position comes from MovementComponent's x/y, which are
// world units (grid cell * cellSize), so we normalize against the map's
// world size to place the dot.
export default function EntityPositionPreview({ map, entity }) {
  if (!map) return null;

  const movementData = entity.components?.MovementComponent;
  const movement =
    movementData && Number.isFinite(movementData.x) && Number.isFinite(movementData.y) ? movementData : null;
  const worldWidth = (map.width || 1) * (map.cellSize || 1);
  const worldHeight = (map.height || 1) * (map.cellSize || 1);
  const aspect = worldHeight / worldWidth || 1;
  const boxWidth = aspect >= 1 ? Math.round(MAX_SIZE / aspect) : MAX_SIZE;
  const boxHeight = aspect >= 1 ? MAX_SIZE : Math.round(MAX_SIZE * aspect);

  return (
    <div className="entity-map-preview">
      <h3>Position</h3>
      <div className="entity-map-preview-box" style={{ width: boxWidth, height: boxHeight }}>
        {movement && (
          <div
            className="entity-map-preview-marker"
            style={{
              left: `${clampPct((movement.x / worldWidth) * 100)}%`,
              top: `${clampPct((movement.y / worldHeight) * 100)}%`,
              transform: `translate(-50%, -50%) rotate(${movement.angle ?? 0}rad)`,
            }}
            title={`x: ${movement.x}, y: ${movement.y}`}
          >
            <span className="entity-map-preview-facing" />
          </div>
        )}
      </div>
      {!movement && (
        <div className="hint-text">
          {movementData
            ? "Set X and Y on the Movement component to place this entity."
            : "Add a Movement component to place this entity on the map."}
        </div>
      )}
    </div>
  );
}
