// Looks up entity templates from the editor's own templates document
// (scripts/data/templates -- see src/templates/) instead of importing
// the game's SharedData.js. Templates are now created/edited entirely
// inside the editor, so "Add Entity" reflects those edits immediately
// rather than a frozen snapshot of componentDefaults.
export function templateTypeNames(templatesData) {
  return Object.keys(templatesData ?? {});
}

export function templateFor(templatesData, type) {
  return templatesData?.[type] ?? {};
}
