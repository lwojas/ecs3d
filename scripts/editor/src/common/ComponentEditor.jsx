import React from "react";
import JsonFieldEditor from "./JsonFieldEditor.jsx";
import { componentDefinitions } from "../data/componentDefinitions.js";

// Turns "mouseSensitivity" into "Mouse Sensitivity" when a field has no
// explicit `label`.
function friendlyLabel(key) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// One control per editor field `type`. Array/object fields have no
// dedicated widget (out of scope here) so they reuse the same
// textarea+Apply editor as the no-metadata fallback, just scoped to
// that one field instead of the whole component.
function FieldControl({ type, value, onChange }) {
  switch (type) {
    case "number":
      return (
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "boolean":
      return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
    case "string":
      return <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "array":
    case "object":
    default:
      return <JsonFieldEditor value={value ?? (type === "array" ? [] : {})} onApply={onChange} />;
  }
}

// Renders one selected component's data. Components with `static editor`
// metadata (see componentDefinitions.js) get a field-based form built
// from that metadata; everything else falls back to raw JSON editing so
// a component never becomes unusable just for lacking metadata.
export default function ComponentEditor({ name, data, onChange }) {
  const definition = componentDefinitions[name];

  if (!definition?.fields) {
    return (
      <div className="component-editor">
        <h5>{name}</h5>
        <JsonFieldEditor value={data} onApply={onChange} />
      </div>
    );
  }

  const fieldEntries = Object.entries(definition.fields);

  return (
    <div className="component-editor">
      <h5>{name}</h5>
      {fieldEntries.length === 0 && <p className="hint-text">No editable fields.</p>}
      {fieldEntries.map(([key, field]) => (
        <label key={key} className={field.type === "boolean" ? "field checkbox" : "field"}>
          {field.label ?? friendlyLabel(key)}
          <FieldControl
            type={field.type}
            value={data?.[key]}
            onChange={(value) => onChange({ ...data, [key]: value })}
          />
        </label>
      ))}
    </div>
  );
}
