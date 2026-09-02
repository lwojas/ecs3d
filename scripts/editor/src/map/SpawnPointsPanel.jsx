import React, { useState } from "react";

export default function SpawnPointsPanel({ spawnPoints, selected, onSelect, onChange, onAdd, onRename, onDelete }) {
  const [newName, setNewName] = useState("");
  const names = Object.keys(spawnPoints ?? {});
  const point = selected ? spawnPoints[selected] : null;

  return (
    <div className="spawn-points-panel">
      <h3>Spawn Points</h3>
      <ul className="entity-list">
        {names.map((name) => (
          <li
            key={name}
            className={name === selected ? "list-item selected" : "list-item"}
            onClick={() => onSelect(name)}
          >
            {name}
          </li>
        ))}
      </ul>

      <div className="add-row">
        <input placeholder="new point name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button
          disabled={!newName || spawnPoints[newName]}
          onClick={() => {
            onAdd(newName);
            setNewName("");
          }}
        >
          + Add
        </button>
      </div>

      {point && (
        <div className="spawn-point-detail">
          <label className="field">
            Name
            <input
              key={selected}
              defaultValue={selected}
              onBlur={(e) => {
                if (e.target.value !== selected) onRename(selected, e.target.value);
              }}
            />
          </label>
          <label className="field inline">
            Cell X
            <input
              type="number"
              step="0.5"
              value={point.cellX}
              onChange={(e) => onChange(selected, { ...point, cellX: Number(e.target.value) })}
            />
          </label>
          <label className="field inline">
            Cell Y
            <input
              type="number"
              step="0.5"
              value={point.cellY}
              onChange={(e) => onChange(selected, { ...point, cellY: Number(e.target.value) })}
            />
          </label>
          <label className="field inline">
            Angle
            <input
              type="number"
              step="0.1"
              value={point.angle ?? 0}
              onChange={(e) => onChange(selected, { ...point, angle: Number(e.target.value) })}
            />
          </label>
          <button className="danger" onClick={() => onDelete(selected)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
