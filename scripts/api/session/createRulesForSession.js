import { SinglePlayerRules } from "../rules/SinglePlayerRules.js";
import { MultiplayerRules } from "../rules/MultiplayerRules.js";
import { WaveRules } from "../rules/WaveRules.js";

// The one place that knows which GameRules subclass a session's
// gameMode maps to. Not a generic factory framework -- just a switch --
// so a real menu/editor can target this same function once it exists.
// `spawner` is only used by rules that request entities dynamically
// (WaveRules today); pass it once the level state has built one.
export function createRulesForSession(session, { spawner } = {}) {
  const rulesConfig = session.rules || {};

  switch (session.gameMode) {
    case "wave":
      return new WaveRules({ ...rulesConfig, spawner });
    case "deathmatch":
      return new MultiplayerRules(rulesConfig);
    case "singleplayer":
    default:
      return new SinglePlayerRules(rulesConfig);
  }
}
