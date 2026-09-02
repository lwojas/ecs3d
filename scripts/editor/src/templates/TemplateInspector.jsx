import React, { useState } from "react";
import ComponentBagEditor from "../common/ComponentBagEditor.jsx";

// `onChange` is an updater over this one template's components:
// (prevComponents) => nextComponents. Give this component a `key={typeName}`
// at the call site so the type-name draft resets when the selected
// template changes.
export default function TemplateInspector({ typeName, components, onChange, onRename }) {
  const [name, setName] = useState(typeName);

  return (
    <div className="entity-inspector">
      <h3>Template</h3>

      <label className="field">
        Type name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== typeName) onRename(typeName, trimmed);
          }}
        />
      </label>

      <ComponentBagEditor components={components} onChange={onChange} />
    </div>
  );
}
