# ECS3D Map Editor

A small React app for authoring the game's map, entity, and entity-template
JSON by hand-editing controls instead of raw JSON. It is isolated from the
game (`scripts/editor/` is its own npm project) and only ever touches JSON
files under `scripts/data/` — it never imports or modifies the game's
runtime `.js` modules, `boot.js`, or ECS component classes.

## Run it

```
cd scripts/editor
npm install
npm run dev
```

Opens on `http://localhost:5183`. `npm run build` produces a static bundle
in `dist/` (not required for day-to-day use — the dev server is the tool).

## The three documents

The editor edits three independent JSON document types, each its own
folder under `scripts/data/`, each with its own Load/Save/New toolbar:

| Type        | Folder                    | Shape                                          |
|-------------|----------------------------|-------------------------------------------------|
| `maps`      | `scripts/data/maps/`       | one map: grid, cells, spawn points/zones        |
| `entities`  | `scripts/data/entities/`   | an array of authored entities                   |
| `templates` | `scripts/data/templates/`  | `{ typeName: { componentName: data } }`         |

They are **never merged**. A map only ever references spawn points by
name; entities only ever reference spawn points and templates by name.
Keep it that way when adding features — don't reach into another
document's shape from inside one editor.

Nothing here is the game's live data. `scripts/data/testMap.js`,
`testEntities.js`, and `SharedData.js` are still what `boot.js` /
`sessions.js` load at runtime. The JSON files were seeded from them once;
editing JSON here doesn't change the running game until someone manually
carries a change back into the `.js` files (or a future task wires the
game to load JSON directly).

## How a document flows through the app

`src/state/useDocument.js` is the one hook both `App.jsx` and every view
build on. It owns exactly four things for one document: `data`, `fileName`,
`dirty`, and the list of files on disk. Everything else — grid painting,
component editing, spawn zones — is just calling:

```js
doc.update((prevData) => nextData)
```

`App.jsx` creates one `useDocument()` per type and renders `MapView`,
`EntityView`, and `TemplatesView` **all three, always** — inactive tabs are
hidden with `display: none`, not unmounted. That's why switching tabs never
loses your current cell/entity/template selection or an unsaved edit sitting
in a text box.

Persistence is a tiny custom Vite middleware (`server/devApiPlugin.js`):
`GET /api/<type>` lists files, `GET /api/<type>/<name>` reads one,
`PUT /api/<type>/<name>` writes one (pretty-printed JSON, directory
created on demand). Document names are restricted to
`[a-zA-Z0-9_-]` — there's no path-traversal surface to worry about there.
`GET /game-assets/<path>` is a second, read-only passthrough to the
repo's `assets/` folder, used only for texture thumbnails.

**If you touch `vite.config.js`'s `server.fs.allow`, be careful**: widening
it once (to let a component import a game file directly) let a crafted
request path escape the project root and serve arbitrary source files —
found and fixed during development. The editor doesn't need it at all
right now; keep it that way unless there's a real cross-project import to
justify it, and if you add one, scope `fs.allow` to the *exact* directory
needed, never a parent that also contains anything sensitive.

## Unknown properties are never silently dropped

Every document's schema is expected to grow. Each editor knows a fixed set
of "known" keys (see `KNOWN_KEYS` near the top of `MapProperties.jsx`,
`CellInspector.jsx`, `EntityInspector.jsx`) and renders explicit controls
for those. Everything else on the same object round-trips through
`src/common/JsonFieldEditor.jsx` under an "Other properties" heading —
`pickRest`/`pickKnown` in `src/common/objectUtils.js` do the splitting.
Component bodies (`ComponentEditor.jsx`) are *always* edited this way —
there's no explicit form for component internals, just JSON.

This is the load-bearing convention for extensibility: **a new property
shows up and is editable the moment it exists in the JSON, with zero code
changes**, just less pleasantly than a dedicated control. Add a dedicated
control only when it's worth the UI.

## Adding things — the common cases

**A new top-level map property** (e.g. `gameMode`): do nothing. It already
round-trips via the map's "Other properties" JSON box. Add an explicit
field in `MapProperties.jsx` (and its `KNOWN_KEYS` list) only once it's
common enough to deserve a real control.

**A new cell property**: same deal — falls into `CellInspector.jsx`'s
"Other properties" box automatically. Add an explicit field + add its key
to `CellInspector.jsx`'s `KNOWN_KEYS` for a first-class control (see how
`wall`/`floor`/`ceiling`/`fog`/`sections` are each a small dedicated
sub-editor).

**A new component class** (e.g. you add `DoorComponent.js` to
`scripts/components/`): add its name to `src/data/componentDefinitions.js`
so "+ Add Component" offers it. That file is a plain name registry, not a
schema — the component's data is edited as JSON regardless. To eventually
give a component real fields instead of JSON, add a `fields` map to its
entry there and extend `ComponentEditor.jsx`'s `definition?.fields` branch
(currently unimplemented — every component falls through to JSON today).

**A new entity type / template**: no code change. Open the Templates tab,
add a type name, add components. It shows up in Entities → "+ Add Entity"
immediately, because `EntityList.jsx` reads the live templates document
rather than any hardcoded list. `entityTemplates.js`'s `templateFor()` is
the only place that knows how to look a template up — reuse it rather than
reaching into `templatesDoc.data` directly if you add another component
that needs a template.

**A new texture/asset**: add a `key: url` entry to `src/data/editorAssets.js`,
mirroring whatever `boot.js`'s `preload()` loads it as. This file is a
manually-maintained, editor-only lookup — it is deliberately not generated
from `boot.js` (that file stays untouched and Phaser-specific) and is
isolated enough to be swapped for a real asset browser later.

**A whole new document type** (rare): add a directory constant in
`devApiPlugin.js`'s `dataDirs`, add a `useDocument("newtype", createEmpty)`
call in `App.jsx`, add a tab, add a view. Copy `TemplatesView.jsx` as the
starting point — it's the smallest of the three.

## Conventions worth knowing before you change grid/entity code

- Grid cell ids are single ASCII digits (`"0"`–`"9"`) because the map's
  `map` rows are strings, one character per cell (`mapGrid.js`). This
  matches the existing game data format on purpose — don't switch to
  multi-character ids without a real reason, since it'd change what
  `scripts/data/maps/*.json` looks like on disk.
- Spawn zones store point *names*, never point data. `map/spawnPoints.js`'s
  `renameSpawnPoint`/`removeSpawnPoint` keep zones in sync when a point is
  renamed or deleted — route any new point-mutating code through those
  instead of touching `spawnPoints/spawnZones` separately.
- Uncontrolled inputs that show one selected item's data (a spawn point's
  name, an entity's uniqueId, a template's type name) are all keyed by that
  item's identity (`key={selected}` / `key={entity.uniqueId}`) so switching
  selection resets the input's draft text instead of showing stale content.
  Follow the same pattern for any new rename-style field.
- Everything that mutates a document goes through `doc.update(prev => next)`
  — never `setState` directly on document data outside `useDocument.js`.
  This is what keeps dirty-tracking and the `*` unsaved-changes indicator
  correct everywhere.
