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
  const resetValue = selected ? getResetValue?.(selected) : undefined;

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
    const value = getResetValue?.(name);
    if (value === undefined) return;
    onChange((prev) => ({ ...prev, [name]: structuredClone(value) }));
  }

  return (
    <div>
      <h4>Components</h4>
      <div className="component-section">
        <div className="component-list-col">
          <ul className="entity-list">
            {componentNames.map((name) => (
              <li
                key={name}
                className={name === selected ? "list-item selected" : "list-item"}
                onClick={() => setSelected(name)}
              >
                <span>{componentDisplayName(name)}</span>
              </li>
            ))}
          </ul>

          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} disabled={availableToAdd.length === 0}>
              + Add Component
            </button>
          ) : (
            <div className="palette-add-options">
              {availableToAdd.map((name) => (
                <button key={name} onClick={() => addComponent(name)}>
                  {componentDisplayName(name)}
                </button>
              ))}
              <button onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          )}
        </div>

        <div className="component-editor-col">
          {selected && components[selected] !== undefined ? (
            <>
              <ComponentEditor
                key={selected}
                name={selected}
                data={components[selected]}
                onChange={(data) => onChange((prev) => ({ ...prev, [selected]: data }))}
              />
              <div className="component-editor-actions">
                {resetValue !== undefined && (
                  <button className="small" onClick={() => resetComponent(selected)}>
                    Reset to Default
                  </button>
                )}
                <button className="danger small" onClick={() => removeComponent(selected)}>
                  Remove Component
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">Select a component to edit</div>
          )}
        </div>
      </div>
    </div>
  );
}

function componentDisplayName(name) {
  return name.endsWith("Component") ? name.slice(0, -"Component".length) : name;
}
