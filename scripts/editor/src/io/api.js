// Thin fetch wrappers around the dev-server API in
// server/devApiPlugin.js. `type` is "maps" or "entities".
const BASE = "/api";

export async function listDocuments(type) {
  const res = await fetch(`${BASE}/${type}`);
  if (!res.ok) throw new Error(`Failed to list ${type}`);
  return res.json();
}

export async function loadDocument(type, name) {
  const res = await fetch(`${BASE}/${type}/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to load ${type}/${name}`);
  return res.json();
}

export async function saveDocument(type, name, data) {
  const res = await fetch(`${BASE}/${type}/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save ${type}/${name}`);
  return res.json();
}
