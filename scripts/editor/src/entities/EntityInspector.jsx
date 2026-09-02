import React, { useState } from "react";
import ComponentBagEditor from "../common/ComponentBagEditor.jsx";
import JsonFieldEditor from "../common/JsonFieldEditor.jsx";
import { pickRest, pickKnown } from "../common/objectUtils.js";
import { templateFor } from "./entityTemplates.js";

const KNOWN_KEYS = ["type", "uniqueId", "components"];

// `onChange` is an entity updater, (prevEntity) => nextEntity.
// `templatesDoc` is the whole templates useDocument() result (not just
// its data) -- "Save as Template" needs to create/update that document,
// not just read it.
export default function EntityInspector({ entity, spawnPointNames, templatesDoc, onChange, onRename }) {
  const [templateName, setTemplateName] = useState(entity.type);
  const spawn = entity.components?.SpawnComponent;
  const template = templateFor(templatesDoc.data, entity.type);

  function saveAsTemplate() {
    const name = templateName.trim();
    if (!name) return;
    // Compute the merged result up front so it's correct regardless of
    // whether templatesDoc.data already exists -- createNew() and
    // update() below both queue state updates, but update()'s
    // (prev) => next form here ignores prev entirely, so it always wins.
    const next = { ...(templatesDoc.data ?? {}), [name]: structuredClone(entity.components ?? {}) };
    if (!templatesDoc.data) templatesDoc.createNew("componentDefaults");
    templatesDoc.update(() => next);
  }

  return (
    <div className="entity-inspector">
      <h3>Entity</h3>

      <label className="field">
        Type
        <input value={entity.type} onChange={(e) => onChange((prev) => ({ ...prev, type: e.target.value }))} />
      </label>

      <label className="field">
        Unique ID
        <input
          key={entity.uniqueId}
          defaultValue={entity.uniqueId}
          onBlur={(e) => {
            if (e.target.value && e.target.value !== entity.uniqueId) onRename(e.target.value);
          }}
        />
      </label>

      <h4>Location</h4>
      {spawn ? (
        <label className="field">
          Spawn point
          <select
            value={spawn.point || ""}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                components: { ...prev.components, SpawnComponent: { ...spawn, point: e.target.value } },
              }))
            }
          >
            <option value="">Select...</option>
            {spawnPointNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <button
          onClick={() =>
            onChange((prev) => ({
              ...prev,
              components: { ...prev.components, SpawnComponent: { point: spawnPointNames[0] || "" } },
            }))
          }
        >
          + Add Spawn Location
        </button>
      )}

      <ComponentBagEditor
        components={entity.components ?? {}}
        onChange={(updater) => onChange((prev) => ({ ...prev, components: updater(prev.components ?? {}) }))}
        getResetValue={(name) => template[name]}
        addDefault={(name) => template[name]}
      />

      <h4>Save as Template</h4>
      <div className="field inline">
        <input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="template type name"
        />
        <button onClick={saveAsTemplate}>Save as Template</button>
      </div>

      <h4>Other properties</h4>
      <JsonFieldEditor
        key={entity.uniqueId}
        value={pickRest(entity, KNOWN_KEYS)}
        onApply={(rest) => onChange((prev) => ({ ...pickKnown(prev, KNOWN_KEYS), ...rest }))}
      />
    </div>
  );
}
