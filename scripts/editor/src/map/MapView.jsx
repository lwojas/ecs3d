import React, { useState } from "react";
import MapProperties from "./MapProperties.jsx";
import TilePalette from "./TilePalette.jsx";
import GridEditor from "./GridEditor.jsx";
import CellInspector from "./CellInspector.jsx";
import SpawnPointsPanel from "./SpawnPointsPanel.jsx";
import SpawnZonesPanel from "./SpawnZonesPanel.jsx";
import { setTile } from "./mapGrid.js";
import { renameSpawnPoint, removeSpawnPoint } from "./spawnPoints.js";

// Layout follows the spec's palette / grid / inspector three-column
// shape (see the project brief) -- a future preview panel can be added
// as a fourth region without touching this structure, since the grid and
// inspector both only ever read/write `doc.data` (plain JSON), never
// anything view-specific.
export default function MapView({ doc }) {
  const [selectedTile, setSelectedTile] = useState("0");
  const [selectedSpawnPoint, setSelectedSpawnPoint] = useState(null);
  const [inspectorTab, setInspectorTab] = useState("properties");

  if (!doc.data) {
    return <div className="empty-state">Load or create a map to begin editing.</div>;
  }

  const map = doc.data;

  function updateMap(updater) {
    doc.update(updater);
  }

  function tabClass(name) {
    return inspectorTab === name ? "tab active" : "tab";
  }

  return (
    <div className="map-view" key={doc.fileName}>
      <aside className="panel palette-panel">
        <TilePalette
          cells={map.cells}
          selectedTile={selectedTile}
          onSelect={(id) => {
            setSelectedTile(id);
            setInspectorTab("cell");
          }}
          onAddCell={(id) => {
            updateMap((prev) => ({
              ...prev,
              cells: {
                ...prev.cells,
                [id]: {
                  floorHeight: 0,
                  ceilingHeight: prev.defaultCeilingHeight ?? 2.5,
                  wall: null,
                  floor: null,
                  ceiling: null,
                },
              },
            }));
            setSelectedTile(id);
            setInspectorTab("cell");
          }}
        />
      </aside>

      <section className="panel grid-panel">
        <GridEditor
          map={map}
          selectedTile={selectedTile}
          selectedSpawnPoint={selectedSpawnPoint}
          onPaint={(x, y) => updateMap((prev) => ({ ...prev, map: setTile(prev.map, x, y, selectedTile) }))}
          onSelectSpawnPoint={(name) => {
            setSelectedSpawnPoint(name);
            setInspectorTab("spawnPoints");
          }}
          onMoveSpawnPoint={(name, cellX, cellY) =>
            updateMap((prev) => ({
              ...prev,
              spawnPoints: { ...prev.spawnPoints, [name]: { ...prev.spawnPoints[name], cellX, cellY } },
            }))
          }
        />
      </section>

      <aside className="panel inspector-panel">
        <div className="inspector-tabs">
          <button className={tabClass("properties")} onClick={() => setInspectorTab("properties")}>
            Map
          </button>
          <button className={tabClass("cell")} onClick={() => setInspectorTab("cell")}>
            Cell
          </button>
          <button className={tabClass("spawnPoints")} onClick={() => setInspectorTab("spawnPoints")}>
            Spawn Points
          </button>
          <button className={tabClass("spawnZones")} onClick={() => setInspectorTab("spawnZones")}>
            Spawn Zones
          </button>
        </div>

        {inspectorTab === "properties" && <MapProperties map={map} onChange={updateMap} />}

        {inspectorTab === "cell" && (
          <CellInspector
            cellId={selectedTile}
            cell={map.cells[selectedTile]}
            onChange={(nextCell) =>
              updateMap((prev) => ({ ...prev, cells: { ...prev.cells, [selectedTile]: nextCell } }))
            }
            onDelete={() => {
              updateMap((prev) => {
                const cells = { ...prev.cells };
                delete cells[selectedTile];
                return { ...prev, cells };
              });
            }}
          />
        )}

        {inspectorTab === "spawnPoints" && (
          <SpawnPointsPanel
            spawnPoints={map.spawnPoints}
            selected={selectedSpawnPoint}
            onSelect={setSelectedSpawnPoint}
            onChange={(name, point) =>
              updateMap((prev) => ({ ...prev, spawnPoints: { ...prev.spawnPoints, [name]: point } }))
            }
            onAdd={(name) => {
              updateMap((prev) => ({
                ...prev,
                spawnPoints: {
                  ...prev.spawnPoints,
                  [name]: { cellX: prev.width / 2, cellY: prev.height / 2, angle: 0 },
                },
              }));
              setSelectedSpawnPoint(name);
            }}
            onRename={(oldName, newName) => {
              updateMap((prev) => renameSpawnPoint(prev, oldName, newName));
              setSelectedSpawnPoint(newName);
            }}
            onDelete={(name) => {
              updateMap((prev) => removeSpawnPoint(prev, name));
              if (selectedSpawnPoint === name) setSelectedSpawnPoint(null);
            }}
          />
        )}

        {inspectorTab === "spawnZones" && (
          <SpawnZonesPanel
            spawnZones={map.spawnZones}
            spawnPointNames={Object.keys(map.spawnPoints ?? {})}
            onChange={(zones) => updateMap((prev) => ({ ...prev, spawnZones: zones }))}
          />
        )}
      </aside>
    </div>
  );
}
