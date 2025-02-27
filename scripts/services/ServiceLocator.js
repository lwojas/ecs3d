export class ServiceLocator {
  static services = {
    system: new Map(),
    game: new Map(),
  };

  static register(category, name, instance) {
    if (!this.services[category])
      throw new Error(
        `Unknown service category: ${category} - from: "${name}"`
      );
    this.services[category].set(name, instance);
  }

  static resolve(category, name) {
    if (!this.services[category]?.get(name))
      throw new Error(
        `Failed to find service: "${name}", you are probably missing a domain (eg. game)`
      );
    return this.services[category]?.get(name);
  }
}
