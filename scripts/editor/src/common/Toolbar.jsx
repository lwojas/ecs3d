import React, { useState } from "react";

// Load/save controls for one document (map or entities). `doc` is
// whatever useDocument() returned -- this component only renders it.
export default function Toolbar({ label, doc }) {
  const [selected, setSelected] = useState("");
  const [saveAsName, setSaveAsName] = useState("");

  function confirmDiscard() {
    return !doc.dirty || window.confirm("Discard unsaved changes?");
  }

  function handleLoad() {
    if (!selected || !confirmDiscard()) return;
    doc.load(selected);
  }

  function handleNew() {
    if (!confirmDiscard()) return;
    const name = window.prompt("New file name?");
    if (name) doc.createNew(name);
  }

  return (
    <div className="toolbar">
      <div className="toolbar-title">
        {label}
        {doc.fileName ? `: ${doc.fileName}` : ""}
        {doc.dirty ? " *" : ""}
      </div>

      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="">Select file...</option>
        {doc.fileList.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button disabled={!selected} onClick={handleLoad}>
        Load
      </button>

      <button onClick={() => doc.save()} disabled={!doc.fileName}>
        Save
      </button>

      <input
        className="save-as-input"
        placeholder="save as..."
        value={saveAsName}
        onChange={(e) => setSaveAsName(e.target.value)}
      />
      <button
        disabled={!saveAsName}
        onClick={() => {
          doc.save(saveAsName);
          setSaveAsName("");
        }}
      >
        Save As
      </button>

      <button onClick={handleNew}>New</button>

      {doc.error && <span className="toolbar-error">{doc.error}</span>}
    </div>
  );
}
