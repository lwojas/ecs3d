// Everything in obj that ISN'T one of knownKeys -- used to expose
// schema-unknown properties (present or future) through a plain JSON
// editor instead of silently dropping them on save.
export function pickRest(obj, knownKeys) {
  const rest = {};
  for (const key of Object.keys(obj ?? {})) {
    if (!knownKeys.includes(key)) rest[key] = obj[key];
  }
  return rest;
}

export function pickKnown(obj, knownKeys) {
  const result = {};
  for (const key of knownKeys) {
    if (obj?.[key] !== undefined) result[key] = obj[key];
  }
  return result;
}
