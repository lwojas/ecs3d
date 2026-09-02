import React, { useState } from "react";
import ComponentEditor from "./ComponentEditor.jsx";
import { componentDefinitions } from "../data/componentDefinitions.js";

// Edits a plain "component name -> data" bag. Used both by
// EntityInspector (one entity's components) and TemplateInspector (one
// template's default components), so it knows nothing about entities or
// templates specifically.
//
// `onChange` is an updater over the bag itself: (prevComponents) =>
// nextComponents.
//
// `getResetValue(name)` and `addDefault(name)` are both optional --
// EntityInspector passes the entity's own template so components can be
// reset to / added from its defaults; TemplateInspector omits them
// since a template has no further default to fall back on (new
// components there just start empty).
export default function ComponentBagEditor({ components, onChange, getResetValue, addDefault }) {
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const componentNames = Object.keys(components ?? {});
  const availableToAdd = Object.keys(componentDefinitions).filter((name) => !componentNames.includes(name));

  function removeComponent(name) {
    onChange((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (selected === name) setSelected(null);
  }

  function addComponent(name) {
    const initial = addDefault?.(name) ?? {};
    onChange((prev) => ({ ...prev, [name]: structuredClone(initial) }));
    setSelected(name);
    setShowAdd(false);
  }

  function resetComponent(name) {
    const resetValue = getResetValue?.(name);
    if (resetValue === undefined) return;
    onChange((prev) => ({ ...prev, [name]: structuredClone(resetValue) }));
  }

  return (
    <div className="component-list">
      <h4>Components</h4>
      <ul className="entity-list">
        {componentNames.map((name) => {
          const resetValue = getResetValue?.(name);
          return (
            <li
              key={name}
              className={name === selected ? "list-item selected" : "list-item"}
              onClick={() => setSelected(name)}
            >
              <span>{name}</span>
              <span className="component-actions">
                {resetValue !== undefined && (
                  <button
                    className="small"
                    title="Reset to template default"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetComponent(name);
                    }}
                  >
                    reset
                  </button>
                )}
                <button
                  className="danger small"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeComponent(name);
                  }}
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      {selected && components[selected] !== undefined && (
        <ComponentEditor
          key={selected}
          name={selected}
          data={components[selected]}
          onChange={(data) => onChange((prev) => ({ ...prev, [selected]: data }))}
        />
      )}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} disabled={availableToAdd.length === 0}>
          + Add Component
        </button>
      ) : (
        <div className="palette-add-options">
          {availableToAdd.map((name) => (
            <button key={name} onClick={() => addComponent(name)}>
              {name}
            </button>
          ))}
          <button onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
