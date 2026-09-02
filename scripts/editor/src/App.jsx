import React, { useEffect, useState } from "react";
import { useDocument } from "./state/useDocument.js";
import { createEmptyMap } from "./map/mapDefaults.js";
import { createEmptyEntities } from "./entities/entityDefaults.js";
import { createEmptyTemplates } from "./templates/templateDefaults.js";
import Toolbar from "./common/Toolbar.jsx";
import MapView from "./map/MapView.jsx";
import EntityView from "./entities/EntityView.jsx";
import TemplatesView from "./templates/TemplatesView.jsx";

const TABS = [
  { id: "map", label: "Map" },
  { id: "entities", label: "Entities" },
  { id: "templates", label: "Templates" },
];

// Map, Entities and Templates are three independent documents (see the
// project brief's data-separation section) -- three separate
// useDocument() instances, never merged into one object. All three
// views stay mounted and are only hidden with CSS when inactive, so
// switching tabs never discards in-progress edits or loses selection.
export default function App() {
  const [activeTab, setActiveTab] = useState("map");
  const mapDoc = useDocument("maps", createEmptyMap);
  const entitiesDoc = useDocument("entities", createEmptyEntities);
  const templatesDoc = useDocument("templates", createEmptyTemplates);

  useEffect(() => {
    mapDoc.refreshList();
    entitiesDoc.refreshList();
    templatesDoc.refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spawnPointNames = Object.keys(mapDoc.data?.spawnPoints ?? {});
  const docsByTab = { map: mapDoc, entities: entitiesDoc, templates: templatesDoc };
  const activeTabInfo = TABS.find((tab) => tab.id === activeTab);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">ECS3D Editor</div>
        <nav className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <Toolbar label={activeTabInfo.label} doc={docsByTab[activeTab]} />

      <main className="app-main">
        <div style={{ display: activeTab === "map" ? "contents" : "none" }}>
          <MapView doc={mapDoc} />
        </div>
        <div style={{ display: activeTab === "entities" ? "contents" : "none" }}>
          <EntityView doc={entitiesDoc} spawnPointNames={spawnPointNames} templatesDoc={templatesDoc} />
        </div>
        <div style={{ display: activeTab === "templates" ? "contents" : "none" }}>
          <TemplatesView doc={templatesDoc} />
        </div>
      </main>
    </div>
  );
}
