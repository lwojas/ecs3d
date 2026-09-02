import React from "react";
import JsonFieldEditor from "../common/JsonFieldEditor.jsx";
import TextureField from "./TextureField.jsx";
import { pickRest, pickKnown } from "../common/objectUtils.js";
import { resizeGrid } from "./mapGrid.js";

const KNOWN_KEYS = [
  "width",
  "height",
  "defaultCeilingHeight",
  "defaultFloorHeight",
  "cellSize",
  "ambient",
  "sky",
  "map",
  "cells",
  "spawnPoints",
  "spawnZones",
];

// `onChange` here is an updater, (prevMapData) => nextMapData -- the same
// contract MapView passes through to doc.update().
export default function MapProperties({ map, onChange }) {
  function set(patch) {
    onChange((prev) => ({ ...prev, ...patch }));
  }

  function resize(width, height) {
    onChange((prev) => ({ ...prev, width, height, map: resizeGrid(prev.map, width, height, "0") }));
  }

  return (
    <div className="map-properties">
      <h3>Map Properties</h3>

      <label className="field inline">
        Width
        <input type="number" min={1} value={map.width} onChange={(e) => resize(Number(e.target.value), map.height)} />
      </label>

      <label className="field inline">
        Height
        <input type="number" min={1} value={map.height} onChange={(e) => resize(map.width, Number(e.target.value))} />
      </label>

      <label className="field inline">
        Cell size
        <input type="number" value={map.cellSize} onChange={(e) => set({ cellSize: Number(e.target.value) })} />
      </label>

      <label className="field inline">
        Default floor height
        <input
          type="number"
          value={map.defaultFloorHeight}
          onChange={(e) => set({ defaultFloorHeight: Number(e.target.value) })}
        />
      </label>

      <label className="field inline">
        Default ceiling height
        <input
          type="number"
          value={map.defaultCeilingHeight}
          onChange={(e) => set({ defaultCeilingHeight: Number(e.target.value) })}
        />
      </label>

      <label className="field inline">
        Ambient
        <input type="number" step="0.01" value={map.ambient} onChange={(e) => set({ ambient: Number(e.target.value) })} />
      </label>

      <TextureField value={map.sky?.texture} onChange={(texture) => set({ sky: { ...map.sky, texture } })} />

      <h4>Other properties</h4>
      <JsonFieldEditor
        value={pickRest(map, KNOWN_KEYS)}
        onApply={(rest) => onChange((prev) => ({ ...pickKnown(prev, KNOWN_KEYS), ...rest }))}
      />
    </div>
  );
}
