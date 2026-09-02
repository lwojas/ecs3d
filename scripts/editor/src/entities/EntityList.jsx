import React, { useState } from "react";

function nextUniqueId(entities, type) {
  const existing = new Set(entities.map((e) => e.uniqueId));
  let n = 1;
  let candidate = `${type}_${n}`;
  while (existing.has(candidate)) {
    n += 1;
    candidate = `${type}_${n}`;
  }
  return candidate;
}

// `templatesData` is the loaded templates document (see src/templates/),
// or null if none is loaded -- "+ Add Entity" always offers a blank,
// manually-built entity regardless, and additionally offers one button
// per template type when a templates document is loaded.
export default function EntityList({ entities, selectedId, onSelect, onAdd, onRemove, templatesData }) {
  const [showAdd, setShowAdd] = useState(false);
  const [blankType, setBlankType] = useState("");
  const templateTypes = Object.keys(templatesData ?? {});

  function addFromTemplate(type) {
    const id = nextUniqueId(entities, type);
    onAdd(type, id, structuredClone(templatesData[type]));
    setShowAdd(false);
  }

  function addBlank() {
    const type = blankType.trim();
    if (!type) return;
    const id = nextUniqueId(entities, type);
    onAdd(type, id, {});
    setBlankType("");
    setShowAdd(false);
  }

  return (
    <div className="list-panel">
      <h3>Entities</h3>
      <ul className="entity-list">
        {entities.map((entity) => (
          <li
            key={entity.uniqueId}
            className={entity.uniqueId === selectedId ? "list-item selected" : "list-item"}
            onClick={() => onSelect(entity.uniqueId)}
          >
            <span className="entity-type">{entity.type}</span>
            <span className="entity-id">{entity.uniqueId}</span>
            <button
              className="danger small"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(entity.uniqueId);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}>+ Add Entity</button>
      ) : (
        <div className="add-entity-panel">
          {templateTypes.length > 0 ? (
            <div className="palette-add-options">
              {templateTypes.map((type) => (
                <button key={type} onClick={() => addFromTemplate(type)}>
                  {type}
                </button>
              ))}
            </div>
          ) : (
            <p className="hint-text">No templates loaded -- open the Templates tab to load or create one.</p>
          )}

          <div className="add-row">
            <input
              placeholder="blank entity type"
              value={blankType}
              onChange={(e) => setBlankType(e.target.value)}
            />
            <button disabled={!blankType.trim()} onClick={addBlank}>
              + Add Blank
            </button>
          </div>

          <button onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
