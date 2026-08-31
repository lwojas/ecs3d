// Single-player/co-op host for the session architecture (Cases A + B).
// Hosts a GameSession -- it doesn't build one itself, decide which
// entities exist, or decide who the player is; see
// scripts/api/session/GameSession.js for that.
import { GameSession } from "./api/session/GameSession.js";

export class SinglePlayerWhiteroom {
  // Phaser 2's existing state lifecycle (init -> preload -> create) --
  // just not previously used. `game.state.start(key, ..., session)`
  // forwards extra args here.
  init(session) {
    this.session = session;
  }

  preload() {}

  create() {
    this.gameSession = new GameSession(this.session, { game: this.game });
    this.gameSession.start();
  }

  update() {
    this.gameSession.update();
  }

  shutdown() {
    if (this.gameSession) {
      this.gameSession.destroy();
      this.gameSession = null;
    }
  }
}
