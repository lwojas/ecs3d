import { testMap } from "../../data/testMap.js";
import { testEntities } from "../../data/testEntities.js";

// The contract a future main-menu configurator will eventually produce.
// `map`/`entities` are string keys (not live object references) so this
// stays plain, serializable data -- exactly what an editor/menu would
// read and write. These are hand-written stand-ins for that menu;
// nothing here builds it.
//
//   gameMode      -- which rules class createRulesForSession() picks
//   map           -- looked up via resolveMapData() below
//   entities      -- optional; looked up via resolveEntityData() below.
//                    Omitted means "no authored entities" (e.g.
//                    deathmatch with bots) -- GameSession treats that as
//                    an empty list, not an error.
//   players       -- [{ id, name, controller?, team?, state?, modifiers? }].
//                    A bot is a player controlled by AI, not a separate
//                    entity population -- see resolveSessionPlayers()
//                    below. `controller` ("human" by default) and `team`
//                    are independent of each other. GameSession resolves
//                    one `prefab: "player"` entity per player: an
//                    authored entity whose uniqueId matches the player's
//                    id if entity data provides one, otherwise a
//                    dynamically spawned one.
//   botCount      -- optional shorthand; resolveSessionPlayers() expands
//                    it into ordinary `controller: "bot"` player entries
//                    (still `prefab: "player"`, never `"enemy"`). Not
//                    nested under `rules` -- it's session/spawning
//                    config, not a gameplay decision.
//   botTeam       -- team assigned to bots expanded from botCount
//                    (default "blue"); irrelevant to explicitly authored
//                    bot entries, which set their own `team`.
//   rules         -- passed straight through to the rules class constructor
//   modifiers     -- optional scenario-level config applied to every
//                    player (see EntitySpawner's applyModifiers) --
//                    construction-time config only, never runtime state.
//   botModifiers  -- like `modifiers`, but layered on top and only for
//                    players with `controller: "bot"`. A human never
//                    sees these. Precedence (later overrides earlier,
//                    not cumulative): modifiers -> player.modifiers ->
//                    botModifiers. See GameSession.buildWorld().
const maps = {
  testMap,
};

const entityDatasets = {
  testEntities,
};

// Accepts either a registered string key or already-resolved data
// passed straight through (used by tests to exercise GameSession without
// registering one-off fixtures in the tables above; every real session
// still just passes a string key).
export function resolveMapData(nameOrData) {
  if (typeof nameOrData !== "string") return nameOrData;
  const map = maps[nameOrData];
  if (!map) {
    throw new Error(`Unknown map: "${nameOrData}"`);
  }
  return map;
}

export function resolveEntityData(nameOrData) {
  if (typeof nameOrData !== "string") return nameOrData;
  const entities = entityDatasets[nameOrData];
  if (!entities) {
    throw new Error(`Unknown entity dataset: "${nameOrData}"`);
  }
  return entities;
}

// A bot is a player controlled by AI -- not a separate population.
// `session.players` is the one player roster; `controller` ("human" by
// default) and `team` are orthogonal fields on each entry, independent
// of each other. `botCount` is kept only as authoring shorthand (so
// existing test session data doesn't need to enumerate bots by hand)
// and is expanded into ordinary player entries here -- GameSession
// never sees botCount itself, only the resulting flat roster.
export function resolveSessionPlayers(session) {
  const authored = (session.players ?? []).map((player) => ({
    controller: "human",
    ...player,
  }));

  const botCount = session.botCount ?? 0;
  const bots = [];
  for (let i = 0; i < botCount; i++) {
    bots.push({
      id: `bot_${i}`,
      name: `Bot ${i}`,
      controller: "bot",
      team: session.botTeam ?? "blue",
    });
  }

  return [...authored, ...bots];
}

// This is the *persistent* inventory -- GameSession.buildWorld() copies
// it into the player entity's InventoryComponent at session/map start
// (unless the map's entity data authors its own override), via
// InventorySystem. Shape matches InventoryComponent's (`items`/
// `equipped`) so the two sides of that copy read the same way. A
// function (not a shared object literal) so each User gets its own
// `inventory` object instead of sharing one across sessions/instances.
function createTestPlayerState() {
  return {
    health: 100,
    ammo: 20,
    inventory: {
      items: ["pistol", "shotgun"],
      equipped: "shotgun",
    },
    resources: {
      plasma: 150,
    },
  };
}

// Case A: authored entities (testEntities.js), no dynamic spawning.
export const singlePlayerSession = {
  gameMode: "singleplayer",
  map: "testMap",
  entities: "testEntities",
  players: [{ id: "player-1", name: "Player", state: createTestPlayerState() }],
  rules: {
    spawn: { x: 14, y: 14 },
    friendlyFire: false,
  },
};

// Same authored entities as Case A, but with a second human player --
// only "player-1" matches an authored entity; "player-2" proves the
// dynamic player-spawn path (GameSession spawns it via the "players"
// zone) without the Phaser state creating anything.
export const coopSession = {
  gameMode: "singleplayer",
  map: "testMap",
  entities: "testEntities",
  players: [
    { id: "player-1", name: "Player 1", state: createTestPlayerState() },
    { id: "player-2", name: "Player 2", state: createTestPlayerState() },
  ],
  rules: {
    spawn: { x: 14, y: 14 },
  },
};

// Case B: same map/entities, but entity data does NOT contain the wave's
// enemies -- WaveRules requests them dynamically through the same
// EntitySpawner.
export const coopWaveSession = {
  gameMode: "wave",
  map: "testMap",
  entities: "testEntities",
  players: [{ id: "player-1", name: "Player", state: createTestPlayerState() }],
  rules: {
    waves: [{ prefab: "enemy", count: 3, spawnZone: "courtyard" }],
  },
};

// Case C: no authored entities at all -- players and bots both come from
// session config via the same spawner, and are now the same population
// (a bot is a player controlled by AI, not a separate enemy entity --
// see resolveSessionPlayers). `team` here is illustrative -- red vs blue
// is already enough for AISystem's hostility check without it (unset vs
// "blue" already differ), but it makes the model explicit.
//
// `botModifiers` is the bot-only counterpart to `modifiers` (see
// GameSession.buildWorld() for the merge precedence) -- this
// healthMultiplier was previously sitting under the general `modifiers`
// key, which meant unifying the player/bot spawn loop leaked it onto
// the human player too. It's bot-specific config, so it belongs here.
export const deathmatchBotSession = {
  gameMode: "deathmatch",
  map: "testMap",
  players: [
    {
      id: "player-1",
      name: "Player",
      controller: "human",
      team: "red",
      state: createTestPlayerState(),
    },
  ],
  botCount: 3,
  botTeam: "blue",
  rules: {
    scoreLimit: 10,
  },
  botModifiers: {
    healthMultiplier: 1.5,
  },
};
