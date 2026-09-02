import React from "react";
import TextureField from "./TextureField.jsx";
import JsonFieldEditor from "../common/JsonFieldEditor.jsx";
import { pickRest, pickKnown } from "../common/objectUtils.js";

const KNOWN_KEYS = [
  "name",
  "floorHeight",
  "ceilingHeight",
  "wall",
  "floor",
  "ceiling",
  "fog",
  "blocking",
  "sections",
];

export default function CellInspector({ cellId, cell, onChange, onDelete }) {
  if (!cell) return <div className="empty-state">Select a tile in the palette.</div>;

  function set(patch) {
    onChange({ ...cell, ...patch });
  }

  function setSurface(key, patch) {
    const current = cell[key] || { texture: "", width: 4, height: 4 };
    set({ [key]: { ...current, ...patch } });
  }

  function toggleSurface(key, enabled) {
    set({ [key]: enabled ? { texture: "", width: 4, height: 4 } : null });
  }

  return (
    <div className="cell-inspector" key={cellId}>
      <h3>Cell {cellId}</h3>

      <label className="field">
        Name
        <input
          value={cell.name || ""}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={`Cell ${cellId}`}
        />
      </label>

      <label className="field inline">
        Floor height
        <input
          type="number"
          value={cell.floorHeight ?? 0}
          onChange={(e) => set({ floorHeight: Number(e.target.value) })}
        />
      </label>

      <label className="field inline">
        Ceiling height
        <input
          type="number"
          value={cell.ceilingHeight ?? 0}
          onChange={(e) => set({ ceilingHeight: Number(e.target.value) })}
        />
      </label>

      <label className="field checkbox">
        <input
          type="checkbox"
          checked={cell.blocking !== false}
          onChange={(e) => set({ blocking: e.target.checked ? undefined : false })}
        />
        Blocking
      </label>

      <Surface
        title="Wall"
        surface={cell.wall}
        onToggle={(on) => toggleSurface("wall", on)}
        onChange={(patch) => setSurface("wall", patch)}
      />
      <Surface
        title="Floor"
        surface={cell.floor}
        onToggle={(on) => toggleSurface("floor", on)}
        onChange={(patch) => setSurface("floor", patch)}
      />
      <Surface
        title="Ceiling"
        surface={cell.ceiling}
        onToggle={(on) => toggleSurface("ceiling", on)}
        onChange={(patch) => setSurface("ceiling", patch)}
      />

      <FogEditor fog={cell.fog} onChange={(fog) => set({ fog })} />

      <SectionsEditor sections={cell.sections} onChange={(sections) => set({ sections })} />

      <h4>Other properties</h4>
      <JsonFieldEditor
        key={cellId}
        value={pickRest(cell, KNOWN_KEYS)}
        onApply={(rest) => onChange({ ...pickKnown(cell, KNOWN_KEYS), ...rest })}
      />

      <button className="danger" onClick={onDelete}>
        Delete Cell
      </button>
    </div>
  );
}

function Surface({ title, surface, onToggle, onChange }) {
  return (
    <fieldset className="surface-field">
      <legend>
        <label className="checkbox">
          <input type="checkbox" checked={!!surface} onChange={(e) => onToggle(e.target.checked)} />
          {title}
        </label>
      </legend>
      {surface && (
        <>
          <TextureField value={surface.texture} onChange={(texture) => onChange({ texture })} />
          <label className="field inline">
            Width
            <input
              type="number"
              value={surface.width ?? 4}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
            />
          </label>
          <label className="field inline">
            Height
            <input
              type="number"
              value={surface.height ?? 4}
              onChange={(e) => onChange({ height: Number(e.target.value) })}
            />
          </label>
        </>
      )}
    </fieldset>
  );
}

function rgbToHex(color) {
  if (!color) return "#000000";
  const toHex = (v) => Math.max(0, Math.min(255, v ?? 0)).toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function FogEditor({ fog, onChange }) {
  return (
    <fieldset className="surface-field">
      <legend>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!fog}
            onChange={(e) => onChange(e.target.checked ? { distance: 24, color: { r: 0, g: 0, b: 0 } } : null)}
          />
          Fog
        </label>
      </legend>
      {fog && (
        <>
          <label className="field inline">
            Distance
            <input
              type="number"
              value={fog.distance ?? 24}
              onChange={(e) => onChange({ ...fog, distance: Number(e.target.value) })}
            />
          </label>
          <label className="field inline">
            Colour
            <input
              type="color"
              value={rgbToHex(fog.color)}
              onChange={(e) => onChange({ ...fog, color: hexToRgb(e.target.value) })}
            />
          </label>
        </>
      )}
    </fieldset>
  );
}

function SectionsEditor({ sections, onChange }) {
  const list = sections ?? [];

  function updateSection(index, patch) {
    const next = list.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function updateMaterial(index, patch) {
    const current = list[index].material || { texture: "", width: 4, height: 4 };
    updateSection(index, { material: { ...current, ...patch } });
  }

  return (
    <div className="sections-editor">
      <h4>Sections</h4>
      {list.map((section, index) => (
        <fieldset key={index} className="surface-field">
          <legend>Section {index + 1}</legend>
          <label className="field inline">
            Bottom
            <input
              type="number"
              value={section.bottom ?? 0}
              onChange={(e) => updateSection(index, { bottom: Number(e.target.value) })}
            />
          </label>
          <label className="field inline">
            Top
            <input
              type="number"
              value={section.top ?? 0}
              onChange={(e) => updateSection(index, { top: Number(e.target.value) })}
            />
          </label>
          <TextureField
            value={section.material?.texture}
            onChange={(texture) => updateMaterial(index, { texture })}
          />
          <label className="field inline">
            Width
            <input
              type="number"
              value={section.material?.width ?? 4}
              onChange={(e) => updateMaterial(index, { width: Number(e.target.value) })}
            />
          </label>
          <label className="field inline">
            Height
            <input
              type="number"
              value={section.material?.height ?? 4}
              onChange={(e) => updateMaterial(index, { height: Number(e.target.value) })}
            />
          </label>
          <button className="danger" onClick={() => onChange(list.filter((_, i) => i !== index))}>
            Remove Section
          </button>
        </fieldset>
      ))}
      <button
        onClick={() => onChange([...list, { bottom: 0, top: 1, material: { texture: "", width: 4, height: 4 } }])}
      >
        + Add Section
      </button>
    </div>
  );
}
