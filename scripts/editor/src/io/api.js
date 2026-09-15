// Thin fetch wrappers around the remote content server.
// Override these with VITE_CONTENT_SERVER_URL and VITE_CONTENT_PROJECT.
const SERVER_URL = (
  import.meta.env.VITE_CONTENT_SERVER_URL || "http://lynn2:4000"
).replace(/\/$/, "");
const PROJECT = import.meta.env.VITE_CONTENT_PROJECT || "raycaster";
const BASE = `${SERVER_URL}/api/projects/${encodeURIComponent(PROJECT)}`;

async function request(url, options, action) {
  const res = await fetch(url, options);
  if (res.ok) return res.json();

  let detail = "";
  try {
    const body = await res.json();
    detail = body.error ? `: ${body.error}` : "";
  } catch {
    // Keep the status-based message when the server does not return JSON.
  }
  throw new Error(`${action} (${res.status})${detail}`);
}

export async function listDocuments(type) {
  const result = await request(
    `${BASE}/${encodeURIComponent(type)}`,
    undefined,
    `Failed to list ${type}`,
  );
  return result.documents;
}

export async function loadDocument(type, name) {
  return request(
    `${BASE}/${encodeURIComponent(type)}/${encodeURIComponent(name)}`,
    undefined,
    `Failed to load ${type}/${name}`,
  );
}

export async function saveDocument(type, name, data) {
  return request(
    `${BASE}/${encodeURIComponent(type)}/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    `Failed to save ${type}/${name}`,
  );
}
