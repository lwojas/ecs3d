import React, { useState } from "react";

export default function TemplateList({ templates, selected, onSelect, onAdd, onRemove }) {
  const [newName, setNewName] = useState("");
  const names = Object.keys(templates ?? {});

  return (
    <div className="list-panel">
      <h3>Templates</h3>
      <ul className="entity-list">
        {names.map((name) => (
          <li
            key={name}
            className={name === selected ? "list-item selected" : "list-item"}
            onClick={() => onSelect(name)}
          >
            <span className="entity-id">{name}</span>
            <button
              className="danger small"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(name);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="add-row">
        <input placeholder="new template type" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button
          disabled={!newName.trim() || templates?.[newName.trim()]}
          onClick={() => {
            onAdd(newName.trim());
            setNewName("");
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
