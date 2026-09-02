// Single-player/co-op host for the session architecture (Cases A + B).
// A thin host: it resolves the persistent GameplaySession that boot.js
// (eventually a menu/configurator) already built, and only owns the
// current MapWorld's lifetime -- it never constructs a GameplaySession
// itself, and shutdown() only tears down the map, never the persistent
// Gameplay/Rules/Users. See scripts/api/session/GameplaySession.js and
// scripts/api/session/MapWorld.js.
import { MapWorld } from "./api/session/MapWorld.js";
import { ServiceLocator } from "./services/ServiceLocator.js";

export class SinglePlayerWhiteroom {
  // Phaser 2's existing state lifecycle (init -> preload -> create).
  // `game.state.start(key, ..., mapContext)` forwards extra args here --
  // an optional { map, entities } override for the map this state
  // should load, on top of the persistent session's own config (used by
  // a future map transition; the first load needs no override).
  init(mapContext) {
    this.mapContext = mapContext;
  }

  preload() {}

  create() {
    const gameplaySession = ServiceLocator.resolve("system", "GameplaySession");

    BasicGame.ServiceLocator = ServiceLocator;

    if (this.mapContext?.map) gameplaySession.config.map = this.mapContext.map;
    if (this.mapContext && "entities" in this.mapContext) {
      gameplaySession.config.entities = this.mapContext.entities;
    }

    this.world = new MapWorld(gameplaySession, { game: this.game });
    this.world.start();
  }

  update() {
    this.world.update();
  }

  shutdown() {
    if (this.world) {
      this.world.destroy();
      this.world = null;
    }
  }
}
