import React from "react";
import { useEditorAssets } from "../EditorAssetsContext.jsx";

// Cell ids stay single characters, to keep the existing string-row grid
// format (see mapGrid.js) -- but the alphabet now runs 0-9, then a-z, then
// A-Z (62 possible cells) instead of just 0-9. New cells are assigned the
// next free id in this sequence automatically, so nothing in the UI ever
// asks the user to pick one.
const ID_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function nextFreeId(cells) {
  return ID_ALPHABET.find((id) => !(id in cells));
}

function swatchStyle(cellDef, assets) {
  const textureKey = cellDef?.wall?.texture || cellDef?.floor?.texture;
  const url = textureKey && assets[textureKey];
  if (url) return { backgroundImage: `url(${url})`, backgroundSize: "cover" };
  return { backgroundColor: cellDef?.wall ? "#565660" : "#2a2a30" };
}

export default function TilePalette({
  cells,
  selectedTile,
  onSelect,
  onAddCell,
}) {
  const { assets } = useEditorAssets();
  const usedIds = Object.keys(cells);
  const freeId = nextFreeId(cells);

  return (
    <div className="tile-palette">
      <h3>Tile Palette</h3>
      <ul className="palette-list">
        {usedIds.map((id) => (
          <li
            key={id}
            className={
              id === selectedTile ? "palette-item selected" : "palette-item"
            }
            onClick={() => onSelect(id)}
          >
            <span
              className="palette-swatch"
              style={swatchStyle(cells[id], assets)}
            />
            <span className="palette-name">
              {cells[id].name || `Cell ${id}`}
            </span>
          </li>
        ))}
      </ul>

      <button
        disabled={!freeId}
        onClick={() => onAddCell(freeId)}
        title={freeId ? undefined : "All 62 cell ids are in use"}
      >
        + Add Cell
      </button>
    </div>
  );
}
