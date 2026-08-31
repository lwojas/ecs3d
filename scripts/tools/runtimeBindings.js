export const runtimeBindings = new Map();

/**
 * Register a user and create their runtime bindings.
 * Returns the bindings object for convenience.
 */
export function registerUser(userId) {
  if (runtimeBindings.has(userId)) {
    return runtimeBindings.get(userId);
  }

  const bindings = {
    boundInput: null,
    boundCamera: null,
    boundPlayer: null,

    actions: {
      resetBoundInput: null,
    },
  };

  runtimeBindings.set(userId, bindings);

  return bindings;
}

/**
 * Remove a user and all of their runtime bindings.
 */
export function unregisterUser(userId) {
  runtimeBindings.delete(userId);
}

/**
 * Get a user's bindings.
 */
export function getBindings(userId) {
  return runtimeBindings.get(userId) ?? null;
}

export function setAllBindings(userId, target) {
  setBoundInput(userId, target);
  setCameraBinding(userId, target);
  setPlayerBinding(userId, target);
}

export function setCameraBinding(userId, target) {
  const bindings = getBindings(userId);

  if (!bindings) {
    return;
  }

  bindings.boundCamera = target;
}

export function setPlayerBinding(userId, target) {
  const bindings = getBindings(userId);

  if (!bindings) {
    return;
  }

  bindings.boundPlayer = target;
}

// Input controller can bind to this function to reset mouse event target
export function setBoundInput(userId, target) {
  const bindings = getBindings(userId);

  if (!bindings) {
    return;
  }

  bindings.boundInput = target;

  if (bindings.actions.resetBoundInput) {
    bindings.actions.resetBoundInput();
  }
}

export function clearAllBindings(userId) {
  const bindings = getBindings(userId);

  if (!bindings) {
    return;
  }

  bindings.boundInput = null;
  bindings.boundCamera = null;
}
