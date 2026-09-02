// Editor-only registry of known component names, so "+ Add Component"
// has a discoverable list without importing the game's ECS component
// classes (the editor edits authoring data, never live component
// instances -- see ComponentEditor.jsx). This mirrors
// scripts/services/ComponentClasses.js by name only; add a name here
// when a new component class is registered there.
//
// A future entry can add a `fields` map, e.g.
//   MovementComponent: { fields: { speed: "number", angle: "number" } }
// to give a component its own explicit form instead of the fallback
// JSON editor -- ComponentEditor.jsx already checks for `fields` and
// falls back to JSON when it's absent. Nothing needs one yet.
//
// This file is optional by design: a component NOT listed here can
// still be added by typing its name isn't supported today (the "Add
// Component" list is drawn from this registry), but any component
// already present on an entity -- known here or not -- is always
// editable via the fallback JSON editor.

import { componentClasses } from "../../../services/ComponentClasses.js";

// Fix to avoid duplicare component registration, see componentClasses.js for more details

export const componentDefinitions = Object.fromEntries(
  Object.keys(componentClasses).map((name) => [name, {}]),
);
