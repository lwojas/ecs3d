// Multiplayer/bots host for the session architecture (Case C). Kept as
// a separate state from SinglePlayerWhiteroom per the existing
// one-state-per-mode convention, even though the two are now
// near-identical thin hosts -- see level-singleplayer-whiteroom.js for
// the ownership rule both follow: resolve the persistent
// GameplaySession, own only the current MapWorld's lifetime.
import { MapWorld } from "./api/session/MapWorld.js";
import { ServiceLocator } from "./services/ServiceLocator.js";

export class MultiplayerWhiteroom {
  init(mapContext) {
    this.mapContext = mapContext;
  }

  preload() {}

  create() {
    const gameplaySession = ServiceLocator.resolve("system", "GameplaySession");

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
