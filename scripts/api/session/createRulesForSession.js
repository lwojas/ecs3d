import { SinglePlayerRules } from "../rules/SinglePlayerRules.js";
import { MultiplayerRules } from "../rules/MultiplayerRules.js";
import { WaveRules } from "../rules/WaveRules.js";

// The canonical list of gameMode values this function understands, each
// with a human-friendly label -- exported so anything presenting a game
// mode choice (e.g. the HTML menu) reads it from here instead of
// duplicating the mode list next to the switch below.
export const GAME_MODES = [
  { value: "singleplayer", label: "Single Player" },
  { value: "wave", label: "Wave" },
  { value: "deathmatch", label: "Deathmatch" },
];

// The one place that knows which GameRules subclass a session's
// gameMode maps to. Not a generic factory framework -- just a switch --
// so a real menu/editor can target this same function once it exists.
//
// Called once by GameplaySession, before any map/world exists -- rules
// that need the current map's spawner (WaveRules) get it later, via
// GameRules.attachWorld(), each time MapWorld builds a world. See
// GameRules.js.
export function createRulesForSession(session) {
  const rulesConfig = session.rules || {};

  switch (session.gameMode) {
    case "wave":
      return new WaveRules(rulesConfig);
    case "deathmatch":
      return new MultiplayerRules(rulesConfig);
    case "singleplayer":
    default:
      return new SinglePlayerRules(rulesConfig);
  }
}
