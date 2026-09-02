import React, { useRef, useState } from "react";
import { editorAssets } from "../data/editorAssets.js";

const CELL_PX = 28;

function cellBackground(cellDef) {
  const textureKey = cellDef?.wall?.texture || cellDef?.floor?.texture;
  const url = textureKey && editorAssets[textureKey];
  if (url) return { backgroundImage: `url(${url})`, backgroundSize: "cover" };
  if (cellDef?.wall) return { backgroundColor: "#565660" };
  if (cellDef?.sections?.length) return { backgroundColor: "#4c5a78" };
  return { backgroundColor: "#232328" };
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// The visual centerpiece: the tile grid plus spawn-point markers layered
// on top. Painting is a plain pointerdown + pointerenter drag (paintingRef
// tracks "is the mouse down"); moving a marker is a separate drag tracked
// by `draggingPoint`, and a marker's own pointerdown stops propagation so
// it doesn't also paint the tile underneath it.
export default function GridEditor({
  map,
  selectedTile,
  selectedSpawnPoint,
  onPaint,
  onSelectSpawnPoint,
  onMoveSpawnPoint,
}) {
  const containerRef = useRef(null);
  const paintingRef = useRef(false);
  const [draggingPoint, setDraggingPoint] = useState(null);

  function paintAt(x, y) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    onPaint(x, y);
  }

  function stopInteraction() {
    paintingRef.current = false;
    setDraggingPoint(null);
  }

  function handleContainerPointerMove(e) {
    if (!draggingPoint) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cellX = clamp((e.clientX - rect.left) / CELL_PX, 0, map.width);
    const cellY = clamp((e.clientY - rect.top) / CELL_PX, 0, map.height);
    onMoveSpawnPoint(draggingPoint, round2(cellX), round2(cellY));
  }

  return (
    <div
      ref={containerRef}
      className="grid-editor"
      style={{ width: map.width * CELL_PX, height: map.height * CELL_PX }}
      onPointerUp={stopInteraction}
      onPointerLeave={stopInteraction}
      onPointerMove={handleContainerPointerMove}
    >
      <div
        className="grid-tiles"
        style={{ gridTemplateColumns: `repeat(${map.width}, ${CELL_PX}px)` }}
      >
        {map.map.flatMap((row, y) =>
          row.split("").map((tileId, x) => (
            <div
              key={`${x}-${y}`}
              className="grid-cell"
              style={{ width: CELL_PX, height: CELL_PX, ...cellBackground(map.cells[tileId]) }}
              onPointerDown={() => {
                paintingRef.current = true;
                paintAt(x, y);
              }}
              onPointerEnter={() => {
                if (paintingRef.current) paintAt(x, y);
              }}
              title={`(${x}, ${y}) cell ${tileId}`}
            />
          )),
        )}
      </div>

      <div className="grid-markers">
        {Object.entries(map.spawnPoints ?? {}).map(([name, point]) => (
          <div
            key={name}
            className={name === selectedSpawnPoint ? "spawn-marker selected" : "spawn-marker"}
            style={{ left: point.cellX * CELL_PX, top: point.cellY * CELL_PX }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectSpawnPoint(name);
              setDraggingPoint(name);
            }}
            title={name}
          >
            <span className="spawn-marker-label">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
