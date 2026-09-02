import React, { useState } from "react";
import EntityList from "./EntityList.jsx";
import EntityInspector from "./EntityInspector.jsx";

export default function EntityView({ doc, spawnPointNames, templatesDoc }) {
  const [selectedId, setSelectedId] = useState(null);

  if (!doc.data) {
    return <div className="empty-state">Load or create an entity file to begin editing.</div>;
  }

  const entities = doc.data;
  const selectedIndex = entities.findIndex((e) => e.uniqueId === selectedId);
  const selected = selectedIndex >= 0 ? entities[selectedIndex] : null;

  function updateEntities(updater) {
    doc.update(updater);
  }

  function updateSelected(updater) {
    updateEntities((prev) => prev.map((entity, i) => (i === selectedIndex ? updater(entity) : entity)));
  }

  return (
    <div className="list-detail-view" key={doc.fileName}>
      <aside className="panel">
        <EntityList
          entities={entities}
          selectedId={selectedId}
          onSelect={setSelectedId}
          templatesData={templatesDoc.data}
          onAdd={(type, uniqueId, components) => {
            updateEntities((prev) => [...prev, { type, uniqueId, components }]);
            setSelectedId(uniqueId);
          }}
          onRemove={(uniqueId) => {
            updateEntities((prev) => prev.filter((e) => e.uniqueId !== uniqueId));
            if (selectedId === uniqueId) setSelectedId(null);
          }}
        />
      </aside>

      <section className="panel detail-panel">
        {selected ? (
          <EntityInspector
            key={selected.uniqueId}
            entity={selected}
            spawnPointNames={spawnPointNames}
            templatesDoc={templatesDoc}
            onChange={updateSelected}
            onRename={(newId) => {
              updateEntities((prev) => prev.map((e, i) => (i === selectedIndex ? { ...e, uniqueId: newId } : e)));
              setSelectedId(newId);
            }}
          />
        ) : (
          <div className="empty-state">Select an entity to edit.</div>
        )}
      </section>
    </div>
  );
}
