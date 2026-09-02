import React, { useState } from "react";

export default function SpawnZonesPanel({ spawnZones, spawnPointNames, onChange }) {
  const [newZoneName, setNewZoneName] = useState("");
  const zones = spawnZones ?? {};
  const zoneNames = Object.keys(zones);

  function addZone() {
    if (!newZoneName || zones[newZoneName]) return;
    onChange({ ...zones, [newZoneName]: [] });
    setNewZoneName("");
  }

  function removeZone(name) {
    const next = { ...zones };
    delete next[name];
    onChange(next);
  }

  function renameZone(oldName, newName) {
    if (!newName || newName === oldName || zones[newName]) return;
    const next = { ...zones };
    next[newName] = next[oldName];
    delete next[oldName];
    onChange(next);
  }

  function addPointToZone(zoneName, pointName) {
    if (!pointName) return;
    const points = zones[zoneName] ?? [];
    if (points.includes(pointName)) return;
    onChange({ ...zones, [zoneName]: [...points, pointName] });
  }

  function removePointFromZone(zoneName, pointName) {
    onChange({ ...zones, [zoneName]: zones[zoneName].filter((p) => p !== pointName) });
  }

  return (
    <div className="spawn-zones-panel">
      <h3>Spawn Zones</h3>

      {zoneNames.map((zoneName) => (
        <div key={zoneName} className="spawn-zone">
          <div className="spawn-zone-header">
            <input key={zoneName} defaultValue={zoneName} onBlur={(e) => renameZone(zoneName, e.target.value)} />
            <button className="danger" onClick={() => removeZone(zoneName)}>
              Delete Zone
            </button>
          </div>
          <div className="chip-list">
            {zones[zoneName].map((pointName) => (
              <span key={pointName} className="chip">
                {pointName}
                <button onClick={() => removePointFromZone(zoneName, pointName)}>×</button>
              </span>
            ))}
          </div>
          <select value="" onChange={(e) => addPointToZone(zoneName, e.target.value)}>
            <option value="">+ add spawn point...</option>
            {spawnPointNames
              .filter((name) => !zones[zoneName].includes(name))
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </div>
      ))}

      <div className="add-row">
        <input placeholder="new zone name" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} />
        <button disabled={!newZoneName} onClick={addZone}>
          + Add Zone
        </button>
      </div>
    </div>
  );
}
