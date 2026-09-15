# Content Server Refactor

## Summary

The editor now persists map, entity, and template documents through the
remote content server instead of the local Vite filesystem middleware.
Document shapes and editor behavior remain unchanged.

## What changed

- `src/io/api.js` now calls the content server API.
- `useDocument()` and its callers were left unchanged, so loading, selecting,
  editing, dirty tracking, creating, and saving retain their existing flow.
- The list response is normalized from the server's `{ documents: [...] }`
  response to the array expected by `useDocument()`.
- HTTP failures include the operation, status code, and server error when one
  is returned. These messages continue to surface through the existing
  toolbar error display.
- The custom `server/devApiPlugin.js` persistence middleware was removed.
- Vite still serves the editor's image assets statically from the repository's
  `assets/` directory so texture previews continue to work.

## Remote API

The editor uses these endpoints, where `project` defaults to `raycaster`:

```text
GET /api/projects/{project}/{type}
GET /api/projects/{project}/{type}/{name}
PUT /api/projects/{project}/{type}/{name}
```

The supported document types remain:

```text
maps      -> object
entities  -> array
templates -> object
```

The editor sends and receives each complete JSON document. It does not merge
documents or interpret their internal game schema.

## Configuration

Defaults are defined in `src/io/api.js`:

```text
VITE_CONTENT_SERVER_URL=http://lynn2:4000
VITE_CONTENT_PROJECT=raycaster
```

For a different server or project, define Vite environment variables before
starting or building the editor. For example, a local `.env.local` can contain:

```text
VITE_CONTENT_SERVER_URL=http://localhost:4000
VITE_CONTENT_PROJECT=raycaster
```

The server URL may include a trailing slash; the API client removes it before
constructing request URLs.

## Runtime separation

The content server stores editor documents independently from the game's
runtime JavaScript data. Saving a document does not update files loaded by
`boot.js` or `sessions.js`; runtime integration remains a separate concern.

## Verification

From `scripts/editor/`:

```bash
npm run build
```

The editor can also be checked against the configured server with:

```bash
curl http://lynn2:4000/health
curl http://lynn2:4000/api/projects/raycaster/maps
```
