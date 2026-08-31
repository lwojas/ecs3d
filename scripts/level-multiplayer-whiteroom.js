// Multiplayer/bots host for the session architecture (Case C). Hosts a
// GameSession -- it doesn't spawn players or bots itself; GameSession
// reads session.players/session.botCount and does that generically for
// any session, via the same EntitySpawner/PrefabFactory path Case A/B
// use. Kept as a separate state from SinglePlayerWhiteroom per the
// existing one-state-per-mode convention, even though the two are now
// near-identical thin hosts.
import { GameSession } from "./api/session/GameSession.js";

export class MultiplayerWhiteroom {
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
