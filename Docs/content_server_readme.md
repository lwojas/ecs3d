# Content Server

A small Node.js/Express service for storing and serving JSON game content over HTTP.

The initial purpose is to provide a central content service for the raycaster game. The editor can load and save JSON documents over the local network instead of reading and writing files directly from the game repository.

The server deliberately does **not** understand the internal structure of the game data. It stores complete JSON documents and exposes them through a simple HTTP API.

This keeps content storage separate from the game/editor code and provides a path toward eventually deploying the content service independently of the game.

---

## Goals

The server has four main goals:

- Serve JSON content to the editor and, eventually, the game runtime.
- Store content independently from the application source repository.
- Separate content by project.
- Keep the storage implementation replaceable so a database such as MongoDB can be introduced later without changing the HTTP API.

The current storage implementation uses JSON files on disk.

The server does **not**:

- Interpret ECS components.
- Modify individual entities inside a document.
- Know how maps, cells, templates, or entities work internally.
- Transform the existing JSON structures.
- Generate JavaScript runtime files.
- Serve the editor application itself.

The editor remains responsible for editing the contents of a document.

---

# Architecture

The basic architecture is:

```text
┌─────────────────────┐
│       Editor        │
│                     │
│ React / Vite        │
│                     │
│ Loads complete JSON │
│ Edits JSON locally  │
│ Saves complete JSON │
└──────────┬──────────┘
           │
           │ HTTP / JSON
           ▼
┌─────────────────────┐
│   Content Server    │
│                     │
│ Express             │
│                     │
│ Project/document    │
│ routing             │
└──────────┬──────────┘
           │
           │ ContentStore
           ▼
┌─────────────────────┐
│    JsonFileStore    │
│                     │
│ JSON files on disk  │
└─────────────────────┘
```

The important boundary is the `ContentStore`.

```text
HTTP API
   │
   ▼
ContentStore
   │
   ├── JsonFileStore       ← current implementation
   │
   └── future database     ← possible later implementation
```

The HTTP routes should not need to know whether content is stored in files, MongoDB, PostgreSQL, S3, or another backend.

---

# Technology

- Node.js
- Express
- JavaScript
- ES modules
- Docker
- Docker Compose

No TypeScript is used.

---

# Project structure

```text
content_server/
├── package.json
├── package-lock.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── README.md
└── src/
    ├── server.js
    ├── app.js
    ├── config.js
    │
    ├── routes/
    │   └── content.js
    │
    ├── storage/
    │   ├── ContentStore.js
    │   └── JsonFileStore.js
    │
    ├── middleware/
    │   └── errorHandler.js
    │
    └── utils/
        └── validation.js
```

### `server.js`

Application entry point.

Creates the storage implementation, creates the Express application, and starts the HTTP server.

### `app.js`

Creates and configures the Express application.

This contains:

- JSON request parsing
- CORS
- health endpoint
- API routing
- error handling

### `routes/content.js`

Contains the HTTP API.

The routes operate on projects, document types, and document names.

### `storage/ContentStore.js`

Defines the storage interface.

It describes the operations required by the HTTP API without implementing how data is stored.

### `storage/JsonFileStore.js`

Current storage implementation.

Reads and writes JSON files on disk.

### `validation.js`

Validates project names, document names, document types, and basic document shapes.

It deliberately does not validate the internal game schemas.

---

# Content storage

Content is stored in the directory configured by `CONTENT_ROOT`.

When running locally, this defaults to:

```text
./data
```

When running in Docker, it is:

```text
/data
```

The Docker volume maps `/data` to:

```text
/home/lwojas/docker/_apps/content_server_data
```

on `lynn2`.

---

# Storage structure

The storage directory is organised by project:

```text
content_server_data/
└── raycaster/
    ├── templates/
    │   └── shared.json
    │
    ├── entities/
    │   ├── testEntities.json
    │   ├── arenaEntities.json
    │   └── warehouseEntities.json
    │
    └── maps/
        ├── testMap.json
        ├── arena.json
        └── warehouse.json
```

The relationship is:

```text
<project>/
    <document type>/
        <document name>.json
```

For example:

```text
raycaster/
└── maps/
    └── arena.json
```

is exposed through:

```text
/api/projects/raycaster/maps/arena
```

---

# Current document types

The server currently supports three document types.

## Templates

Directory:

```text
templates/
```

Expected top-level JSON type:

```text
object
```

Example:

```json
{
  "player": {
    "MovementComponent": {
      "movable": true
    },
    "ItemComponent": {},
    "InventoryComponent": {}
  }
}
```

The template document contains the shared entity templates used by the editor and runtime.

There is currently one template document:

```text
templates/shared.json
```

The server does not impose any structure on the contents.

---

## Entities

Directory:

```text
entities/
```

Expected top-level JSON type:

```text
array
```

An entity document contains the authored entities for a map or other piece of content.

For example:

```text
entities/testEntities.json
```

The server treats the entire array as an opaque JSON document.

---

## Maps

Directory:

```text
maps/
```

Expected top-level JSON type:

```text
object
```

A map document contains the existing map structure, including its grid, cells, spawn points, spawn zones, and other map properties.

For example:

```text
maps/testMap.json
```

The server does not interpret the map structure.

---

# API

Base URL:

```text
http://localhost:4000/api
```

On the homelab server:

```text
http://lynn2:4000/api
```

---

## Health check

```http
GET /health
```

Example:

```bash
curl http://localhost:4000/health
```

Response:

```json
{
  "status": "ok"
}
```

This endpoint does not access content storage. It simply confirms that the HTTP service is running.

---

# Projects

## List projects

```http
GET /api/projects
```

Example:

```bash
curl http://localhost:4000/api/projects
```

Response:

```json
{
  "projects": ["raycaster"]
}
```

Projects correspond directly to directories under the content root.

---

# Documents

Each project exposes the same document-type API.

The supported document types are:

```text
templates
entities
maps
```

---

## List documents

```http
GET /api/projects/:project/:type
```

Example:

```bash
curl http://localhost:4000/api/projects/raycaster/maps
```

Response:

```json
{
  "project": "raycaster",
  "type": "maps",
  "documents": ["arena", "testMap", "warehouse"]
}
```

The returned names do not include `.json`.

The editor can use this endpoint to populate its document selector.

For example:

```text
Templates:
    shared

Entities:
    testEntities
    arenaEntities

Maps:
    testMap
    arena
```

---

# Get a document

```http
GET /api/projects/:project/:type/:name
```

Example:

```bash
curl http://localhost:4000/api/projects/raycaster/maps/testMap
```

The response is the complete JSON document.

The server does not wrap the document in another object.

For example, if `shared.json` contains:

```json
{
  "player": {
    "MovementComponent": {
      "movable": true
    }
  }
}
```

then:

```http
GET /api/projects/raycaster/templates/shared
```

returns:

```json
{
  "player": {
    "MovementComponent": {
      "movable": true
    }
  }
}
```

This keeps the existing editor data structures unchanged.

---

# Save a document

```http
PUT /api/projects/:project/:type/:name
```

The request body is the complete JSON document.

Example:

```bash
curl -X PUT \
  http://localhost:4000/api/projects/raycaster/templates/shared \
  -H "Content-Type: application/json" \
  -d '{
    "player": {
      "MovementComponent": {
        "movable": true
      }
    }
  }'
```

The server creates the required directories automatically.

The resulting file is:

```text
raycaster/templates/shared.json
```

JSON is stored pretty-printed with two-space indentation.

---

# Document ownership

The editor owns document editing.

The server owns document persistence.

The normal workflow is:

```text
GET document
     │
     ▼
Editor loads JSON
     │
     ▼
User edits document
     │
     ▼
Editor updates its local document state
     │
     ▼
PUT complete document
     │
     ▼
Server replaces stored JSON
```

The server does not provide operations such as:

```text
POST entity
DELETE entity
PATCH component
UPDATE map cell
```

This is intentional.

The existing editor already understands the data structures and knows how to modify them.

The server simply persists the resulting document.

---

# Validation

The server validates the parts of the request that are relevant to storage.

## Project names

Allowed characters:

```text
a-z
A-Z
0-9
_
-
```

For example:

```text
raycaster
raycaster-v2
my_project
```

are valid.

Path traversal such as:

```text
../../something
```

is rejected.

---

## Document names

The same restrictions apply to document names.

Valid:

```text
testMap
arena
arena_v2
test-entities
```

Invalid:

```text
../secret
foo/bar
foo.json/..
```

The `.json` extension is added by the storage layer.

---

## Document type

Only registered document types can be accessed:

```text
templates
entities
maps
```

An unknown type returns an error.

---

## Basic document shape

The server performs only top-level validation.

```text
templates → object
entities  → array
maps      → object
```

It does not validate component schemas, entity properties, map cells, spawn points, etc.

This is important because the content schemas are expected to evolve independently of the server.

---

# Adding another document type

If a new document type is eventually required, it can be added to `config.js`.

For example:

```js
documentTypes: {
  templates: {
    expectedShape: "object"
  },

  entities: {
    expectedShape: "array"
  },

  maps: {
    expectedShape: "object"
  },

  cells: {
    expectedShape: "object"
  }
}
```

The same generic storage and HTTP routes can then handle:

```text
/api/projects/raycaster/cells/shared
```

without adding another route implementation.

This is useful for the planned map-cell template system.

---

# Storage abstraction

The HTTP API depends on the `ContentStore` interface rather than directly on the filesystem.

The current implementation is:

```text
ContentStore
     ▲
     │
JsonFileStore
```

`JsonFileStore` implements:

```js
listProjects();

listDocuments(project, type);

getDocument(project, type, name);

saveDocument(project, type, name, data);
```

A future database implementation could provide the same methods:

```text
ContentStore
     ▲
     │
MongoContentStore
```

The Express routes would not need to change.

This is the main reason the storage layer is separate from the API layer.

---

# Local development

Requirements:

- Node.js
- npm

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm run dev
```

The development server listens on:

```text
http://localhost:4000
```

The local content directory is:

```text
./data
```

Example:

```text
content_server/
├── data/
│   └── raycaster/
│       ├── templates/
│       ├── entities/
│       └── maps/
└── src/
```

The `data/` directory is ignored by Git.

---

# Production

The application is designed to run as a Docker container.

Build the image:

```bash
docker compose build
```

Start it:

```bash
docker compose up -d
```

Check the container:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs -f
```

Stop the container:

```bash
docker compose down
```

---

# Docker configuration

The container listens on port:

```text
4000
```

The host port is also:

```text
4000
```

The content directory inside the container is:

```text
/data
```

The host directory is:

```text
/home/lwojas/docker/_apps/content_server_data
```

The Docker volume therefore provides:

```text
Host:
    /home/lwojas/docker/_apps/content_server_data

        │
        │ Docker volume
        ▼

Container:
    /data
```

The application itself does not need to know anything about the host path.

---

# `lynn2` deployment

The intended deployment environment is the homelab server:

```text
lynn2
```

The server is exposed on:

```text
http://lynn2:4000
```

After the repository has been cloned on `lynn2`:

```bash
cd ~/docker/_apps/content_server
```

Build and start:

```bash
docker compose up -d --build
```

Check:

```bash
curl http://localhost:4000/health
```

From another machine on the LAN:

```bash
curl http://lynn2:4000/health
```

The editor can then use:

```text
http://lynn2:4000/api
```

as its content API.

---

# Content backups

Content is deliberately stored outside the Git repository.

The application repository contains:

```text
application code
Docker configuration
API implementation
storage implementation
```

The separate content volume contains:

```text
game content
```

Current content location:

```text
/home/lwojas/docker/_apps/content_server_data
```

This directory can therefore be backed up independently.

The separation means:

```text
Code repository
        │
        ├── server code
        ├── Docker configuration
        └── API implementation


Content repository / backup
        │
        └── content_server_data
              └── raycaster
                    ├── templates
                    ├── entities
                    └── maps
```

Rebuilding or replacing the Docker container does not remove the content.

---

# Editor integration

The existing editor currently uses a Vite development middleware to read and write files under:

```text
scripts/data/
```

That implementation can eventually be replaced by calls to the content server.

The editor will conceptually change from:

```text
Editor
  │
  ▼
Vite filesystem middleware
  │
  ▼
scripts/data/
```

to:

```text
Editor
  │
  ▼
HTTP
  │
  ▼
Content Server
  │
  ▼
content_server_data/
```

The document structures themselves do not need to change.

The existing editor model of having one independent document for each type remains:

```text
Templates document
Entities document
Map document
```

The editor continues to load and save complete documents.

---

# Runtime integration

The current runtime still consumes the generated JavaScript data used by the game.

The content server does not currently change that workflow.

The intended future architecture is:

```text
Content Server
      │
      │ JSON
      ▼
Runtime loader
      │
      ▼
Game data
```

That integration should be implemented separately.

This server task intentionally does not modify the runtime data structures or runtime launcher.

---

# Future content model

The current structure is intentionally compatible with additional reusable content types.

For example, reusable map-cell templates could eventually be stored as:

```text
raycaster/
├── templates/
│   └── shared.json
│
├── entities/
│   ├── arena.json
│   └── warehouse.json
│
├── maps/
│   ├── arena.json
│   └── warehouse.json
│
└── cells/
    └── shared.json
```

The existing documents remain independent.

A future map can reference a cell template without requiring the server to understand what that reference means.

That interpretation belongs to the editor/runtime.

---

# Design principles

## Keep documents independent

Templates, entities, and maps are separate documents.

Do not merge them into a single server-side representation.

---

## Keep the server schema-light

The server should know:

```text
project
document type
document name
JSON
```

It should not know:

```text
MovementComponent
InventoryComponent
spawnPoints
wall
floor
ceiling
entities
doors
weapons
```

Those belong to the game/editor domain.

---

## Replace whole documents

The server stores complete documents.

This keeps persistence simple and means the editor remains the authority for document manipulation.

---

## Keep storage replaceable

The HTTP layer should depend on:

```text
ContentStore
```

rather than:

```text
fs
```

This allows the storage mechanism to change later without redesigning the API.

---

## Keep content separate from application code

The Docker image contains the application.

The mounted volume contains the content.

This allows the application and content to be deployed, backed up, and versioned independently.

---

# API summary

| Method | Endpoint                             | Purpose             |
| ------ | ------------------------------------ | ------------------- |
| `GET`  | `/health`                            | Check server status |
| `GET`  | `/api/projects`                      | List projects       |
| `GET`  | `/api/projects/:project/:type`       | List documents      |
| `GET`  | `/api/projects/:project/:type/:name` | Load document       |
| `PUT`  | `/api/projects/:project/:type/:name` | Save document       |

Current document types:

```text
templates
entities
maps
```

---

# Example complete content tree

A populated installation might look like:

```text
/home/lwojas/docker/_apps/content_server_data/
└── raycaster/
    │
    ├── templates/
    │   └── shared.json
    │
    ├── entities/
    │   ├── testEntities.json
    │   ├── arenaEntities.json
    │   └── warehouseEntities.json
    │
    └── maps/
        ├── testMap.json
        ├── arena.json
        └── warehouse.json
```

The server sees these as:

```text
Project: raycaster

Templates:
    shared

Entities:
    testEntities
    arenaEntities
    warehouseEntities

Maps:
    testMap
    arena
    warehouse
```

No additional indexing database or metadata file is required.

The directory structure itself is the index.

---

# Current scope

This server intentionally provides the smallest useful foundation for centralised game content.

Included:

- Express HTTP API
- Project separation
- Template documents
- Entity documents
- Map documents
- JSON file storage
- Storage abstraction
- Basic validation
- CORS
- Docker deployment
- Persistent host-mounted storage
- Health endpoint

Not currently included:

- Authentication
- User accounts
- Permissions
- Revision history
- Conflict resolution
- Locking
- Content publishing workflow
- Database storage
- Runtime integration
- Asset storage
- Individual entity/component APIs
- Schema validation of game-specific JSON

These can be added independently if they become necessary.
