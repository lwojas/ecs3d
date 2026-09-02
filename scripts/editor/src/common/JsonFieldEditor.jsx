import React, { useState } from "react";

// Fallback editor for anything the editor doesn't model with explicit
// controls: unknown top-level map/entity/cell properties, and every
// component body (see ComponentEditor.jsx). Give it a React `key` tied to
// whatever object it's editing so it resets its draft text when the
// selection changes instead of showing stale JSON.
export default function JsonFieldEditor({ value, onApply }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);

  function handleChange(e) {
    setText(e.target.value);
    setDirty(true);
  }

  function apply() {
    try {
      const parsed = text.trim() === "" ? {} : JSON.parse(text);
      onApply(parsed);
      setError(null);
      setDirty(false);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="json-field-editor">
      <textarea rows={6} value={text} onChange={handleChange} spellCheck={false} />
      <div className="json-field-actions">
        <button onClick={apply} disabled={!dirty}>
          Apply
        </button>
        {error && <span className="field-error">{error}</span>}
      </div>
    </div>
  );
}
