import React, { useState } from "react";
import { editorAssets } from "../data/editorAssets.js";

const ALL_IDS = "0123456789".split("");

function swatchStyle(cellDef) {
  const textureKey = cellDef?.wall?.texture || cellDef?.floor?.texture;
  const url = textureKey && editorAssets[textureKey];
  if (url) return { backgroundImage: `url(${url})`, backgroundSize: "cover" };
  return { backgroundColor: cellDef?.wall ? "#565660" : "#2a2a30" };
}

// Cell ids stay single digits ("0"-"9") to keep the existing string-row
// grid format (see mapGrid.js) -- so the palette can only offer the
// digits not already used by another cell definition.
export default function TilePalette({ cells, selectedTile, onSelect, onAddCell }) {
  const [showAdd, setShowAdd] = useState(false);
  const usedIds = Object.keys(cells);
  const freeIds = ALL_IDS.filter((id) => !usedIds.includes(id));

  return (
    <div className="tile-palette">
      <h3>Tile Palette</h3>
      <ul className="palette-list">
        {usedIds.map((id) => (
          <li
            key={id}
            className={id === selectedTile ? "palette-item selected" : "palette-item"}
            onClick={() => onSelect(id)}
          >
            <span className="palette-swatch" style={swatchStyle(cells[id])} />
            <span className="palette-id">{id}</span>
            <span className="palette-name">{cells[id].name || `Cell ${id}`}</span>
          </li>
        ))}
      </ul>

      {freeIds.length > 0 &&
        (!showAdd ? (
          <button onClick={() => setShowAdd(true)}>+ Add Cell</button>
        ) : (
          <div className="palette-add-options">
            {freeIds.map((id) => (
              <button
                key={id}
                onClick={() => {
                  onAddCell(id);
                  setShowAdd(false);
                }}
              >
                {id}
              </button>
            ))}
            <button onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        ))}
    </div>
  );
}
