// Editor-only registry of known component names, so "+ Add Component"
// has a discoverable list without duplicating the game's ECS component
// classes. Definitions come straight from each class's own
// `static editor` metadata (see e.g. MovementComponent.js) -- this file
// just re-keys componentClasses by name, it never redefines fields
// itself. A component class with no `static editor` maps to `{}`, which
// tells ComponentEditor.jsx to fall back to the generic JSON editor.
//
// This file is optional by design: a component NOT listed here can't be
// added via "+ Add Component" (that list is drawn from this registry),
// but any component already present on an entity -- known here or not
// -- is always editable via the fallback JSON editor.

import { componentClasses } from "../../../services/ComponentClasses.js";

export const componentDefinitions = Object.fromEntries(
  Object.entries(componentClasses).map(([name, cls]) => [name, cls.editor ?? {}]),
);
