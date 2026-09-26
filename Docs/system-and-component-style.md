# System Conventions

Systems contain gameplay and runtime behaviour. They are divided into two categories based on **how they are invoked**:

1. **Runtime systems** — run continuously as part of the ECS update loop.
2. **API systems** — invoked on demand by other systems or orchestration code.

The distinction is important because it determines how a system accesses entities and components, where state belongs, and how its public interface should be designed.

---

## 1. Runtime Systems

Runtime systems participate in the game update loop.

They are responsible for continuously processing a known set of components, usually once per frame or update tick.

### Basic pattern

A runtime system should:

- Extend `System`.
- Register the component set it operates on with the `EntityManager`.
- Cache the relevant component lists.
- Iterate over the cached lists directly during `update()`.
- Keep operational/runtime state on the system where appropriate.
- Keep persistent game state in components.

### Component lists

Avoid repeatedly resolving components with calls such as:

```js
entity.getComponent("LightComponent");
```

inside the update loop.

Instead, register the relevant component types and resolve them into parallel lists:

```js
this.entities = this.entityManager.registerSystem(this, ["LightComponent"]);

this.refreshList();
```

```js
refreshList() {
  this.lightList = resolveComponentList(
    "LightComponent",
    this.entities,
  );

  this.movementList = resolveComponentList(
    "MovementComponent",
    this.entities,
  );
}
```

The update loop can then operate directly on the components:

```js
update() {
  const len = this.lightList.length;

  for (let i = 0; i < len; i++) {
    const light = this.lightList[i];
    const movement = this.movementList[i];

    if (light.enabled) {
      light.x = movement.x;
      light.y = movement.y;
      light.z = movement.z;
    }
  }
}
```

This avoids repeated component lookups and keeps the hot update path predictable.

### Cached lists are system-owned runtime data

The cached lists are an implementation detail of the system. They exist to make processing efficient and convenient.

They should not become a second source of game state.

For example:

```js
this.lightList;
this.movementList;
```

are derived views of the ECS entities/components. The components remain the authoritative state.

If the set of entities/components can change during runtime, the system must refresh or otherwise maintain these lists according to the ECS lifecycle conventions.

---

## 2. Runtime System State

A system may contain state required for its operation.

For example:

```js
this.renderLightList = renderer.lights;
```

or other state used to coordinate work during an update.

This is **runtime state**, not persistent game state.

A useful distinction is:

| State                            | Belongs in                               |
| -------------------------------- | ---------------------------------------- |
| Entity gameplay state            | Component                                |
| Editable entity configuration    | Component                                |
| Runtime-only component state     | Component, when it describes that entity |
| Temporary processing state       | System                                   |
| Cached component/entity lists    | System                                   |
| External runtime dependency      | System                                   |
| Cross-system orchestration state | Appropriate API/orchestration layer      |

A system should not become a general-purpose container for entity state simply because it is convenient to access from there.

---

## 3. Components

Components hold state belonging to an entity.

They normally contain:

- Entity configuration.
- Gameplay state.
- Runtime state specific to that entity.
- Small operations that naturally belong to the component.

Components can also contain **non-editable runtime state** and orchestration functions when required.

Not everything on a component is therefore part of the editor-facing data model.

### Editor-facing fields

Editable component properties are explicitly exposed through the component's `editor` definition:

```js
static editor = {
  fields: {
    spriteKey: { type: "string" },
    enabled: { type: "boolean" },
    x: { type: "number" },
    y: { type: "number" },
    z: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
    scale: { type: "number" },
    texture: { type: "string" },
    billboard: { type: "boolean" },
    angle: { type: "number" },
    animationState: { type: "string" },
  },
};
```

The `editor` definition is the contract for what the user/editor can configure. Internal runtime properties do not need to be exposed here.

For example, a component may contain a reference to its entity or runtime bookkeeping that is necessary during execution without making that state part of the level data.

### Components should represent entity state

If a value describes **the current state of an entity**, it generally belongs on a component rather than inside a system.

For example:

```js
this.animationState = data.animationState || "idle";
```

is entity state and therefore belongs on `SpriteComponent`.

The system can interpret that state:

```text
AISystem
    ↓
sets animation intent
    ↓
SpriteComponent.animationState
    ↓
SpriteSystem / renderer
    ↓
visual result
```

The component does not need to know how the renderer implements the animation.

---

# 4. API Systems

API systems are different from runtime systems.

They do **not** participate in the update loop.

Instead, they expose functionality that is invoked on demand by other systems, input handling, gameplay orchestration, or other runtime code.

They are closer to specialised helpers, but remain a system when the functionality represents a coherent gameplay/runtime capability.

For example:

```js
updateInteraction(action, boundTarget, userId) {
  if (this.state === "GAME_PLAY") {
    if (!this.itemSystem) return;

    this.playerInteraction(boundTarget, userId);
  }
}
```

The method is called when an interaction occurs rather than once per frame.

---

## 5. API System State

An API system may contain runtime state when the feature needs it.

For example:

```js
constructor(hud, gameplayManager) {
  this.state = "GAME_PLAY";
  this.itemSystem = null;
  this.hud = hud;
  this.itemData = itemData;
  this.gameplayManager = gameplayManager;
}
```

This is appropriate because the system needs references and operational state to implement its API.

API systems can also be stateless where no persistent runtime state is required.

### Class or helper functions?

There is no requirement that every API system must be a class.

Use a **class** when the API needs:

- Runtime state.
- Dependencies.
- References to other systems.
- Configuration.
- Multiple related operations sharing state.

Use **plain functions/helpers** when the functionality:

- Does not need persistent state.
- Has no meaningful lifecycle.
- Does not need injected dependencies.
- Is naturally expressed as a small operation.

The important distinction is the role of the functionality, not whether it happens to use a class.

---

# 6. API Systems vs Runtime Systems

The primary distinction is **invocation model**.

|                      | Runtime System       | API System                     |
| -------------------- | -------------------- | ------------------------------ |
| Invoked by           | ECS update loop      | Other systems / orchestration  |
| Runs continuously    | Yes                  | No                             |
| Main entry point     | `update()`           | Public methods                 |
| Typical work         | Iterate components   | Perform an operation           |
| Component access     | Usually cached lists | Usually targeted/entity access |
| Runtime state        | Yes, when required   | Yes, when required             |
| Must extend `System` | Yes                  | No                             |
| Typical example      | `LightSystem`        | `InteractionSystem`            |

An API system should not be turned into a runtime system merely because it contains several methods.

Likewise, a runtime system should not expose arbitrary helper APIs simply to avoid putting functionality in the appropriate API/orchestration layer.

---

# 7. Accessing Components

Use the access pattern appropriate to the job.

### Runtime iteration

When processing many entities every update:

```js
const len = this.componentList.length;

for (let i = 0; i < len; i++) {
  const component = this.componentList[i];
}
```

Prefer cached component lists over repeatedly calling `getComponent()`.

### Targeted access

When operating on a specific entity in response to an event or API call, direct component access is appropriate:

```js
resolveEquippedItem(boundTarget) {
  return (
    boundTarget.entity
      .getComponent("InventoryComponent")
      ?.equipped ?? null
  );
}
```

There is no benefit in building a cached list simply to handle an occasional targeted operation.

The rule is therefore:

> **Cache for repeated iteration; resolve directly for targeted access.**

---

# 8. System Boundaries

Systems should have a clear responsibility.

A runtime system generally answers:

> "What needs to happen to this set of components during the update?"

An API system generally answers:

> "What operation does another part of the game need this feature to perform?"

Components answer:

> "What state does this entity currently have?"

This separation helps prevent gameplay logic from becoming distributed arbitrarily between systems, components, and orchestration code.

---

# 9. State Ownership

When deciding where a new piece of state belongs, ask what the state describes.

### Entity state

If it describes an entity:

```text
Component
```

Examples:

- Position
- Health
- Equipped item
- Animation intent
- Enabled state
- Collision properties

### Processing state

If it exists only to perform system work:

```text
System
```

Examples:

- Cached component lists
- Renderer references
- Temporary processing collections
- Runtime dependencies

### Feature operation

If it represents something another part of the game explicitly asks the feature to do:

```text
API System
```

Examples:

- Interact with an item
- Enable/disable a set of lights
- Perform a gameplay operation
- Respond to an external event

---

# 10. General Conventions

When adding a new system:

1. **Decide whether it is runtime or API based.**
2. **Give the system one clear responsibility.**
3. **Keep entity state in components.**
4. **Keep derived/cached processing data in the system.**
5. **Cache component lists for repeated update-loop processing.**
6. **Use direct `getComponent()` access for occasional targeted operations.**
7. **Do not expose runtime-only component state through the editor definition.**
8. **Use a class for API functionality when shared runtime state or dependencies are required.**
9. **Use plain helper functions when no system state is required.**
10. **Avoid duplicating authoritative game state inside systems.**
11. **Keep update-loop work predictable and avoid unnecessary per-frame lookups or allocations.**
12. **Prefer explicit system APIs over making unrelated systems reach into each other's internal state.**

The goal is not to enforce a rigid structure for every piece of code. The conventions exist to keep **state ownership, update-loop behaviour, and system responsibilities explicit** as the project grows.
