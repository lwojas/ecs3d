import React, { useState } from "react";
import TemplateList from "./TemplateList.jsx";
import TemplateInspector from "./TemplateInspector.jsx";

// Templates are a third, independent document (see the project's
// data-separation approach for maps/entities) -- a plain
// { typeName: { componentName: data } } map, loaded/saved as JSON under
// scripts/data/templates. Entities' "+ Add Entity" reads this document
// live, so edits here are immediately available there.
export default function TemplatesView({ doc }) {
  const [selected, setSelected] = useState(null);

  if (!doc.data) {
    return <div className="empty-state">Load or create a templates file to begin editing.</div>;
  }

  const templates = doc.data;

  function updateTemplates(updater) {
    doc.update(updater);
  }

  function renameTemplate(oldName, newName) {
    if (!newName || newName === oldName || templates[newName]) return;
    updateTemplates((prev) => {
      const next = { ...prev };
      next[newName] = next[oldName];
      delete next[oldName];
      return next;
    });
    setSelected(newName);
  }

  return (
    <div className="list-detail-view" key={doc.fileName}>
      <aside className="panel">
        <TemplateList
          templates={templates}
          selected={selected}
          onSelect={setSelected}
          onAdd={(name) => {
            updateTemplates((prev) => ({ ...prev, [name]: {} }));
            setSelected(name);
          }}
          onRemove={(name) => {
            updateTemplates((prev) => {
              const next = { ...prev };
              delete next[name];
              return next;
            });
            if (selected === name) setSelected(null);
          }}
        />
      </aside>

      <section className="panel detail-panel">
        {selected && templates[selected] ? (
          <TemplateInspector
            key={selected}
            typeName={selected}
            components={templates[selected]}
            onChange={(updater) =>
              updateTemplates((prev) => ({ ...prev, [selected]: updater(prev[selected] ?? {}) }))
            }
            onRename={renameTemplate}
          />
        ) : (
          <div className="empty-state">Select a template to edit.</div>
        )}
      </section>
    </div>
  );
}
