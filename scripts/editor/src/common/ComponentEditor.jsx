import React from "react";
import JsonFieldEditor from "./JsonFieldEditor.jsx";
import { componentDefinitions } from "../data/componentDefinitions.js";

// Every component is edited as JSON today -- componentDefinitions.js has
// no `fields` entries yet. If one is added later (e.g. MovementComponent:
// { fields: { speed: "number" } }), this is the one place to branch into
// a field-based form instead of the fallback JSON editor.
export default function ComponentEditor({ name, data, onChange }) {
  const definition = componentDefinitions[name];

  if (definition?.fields) {
    // Reserved for a future explicit field editor.
    return null;
  }

  return (
    <div className="component-editor">
      <h5>{name}</h5>
      <JsonFieldEditor value={data} onApply={onChange} />
    </div>
  );
}
