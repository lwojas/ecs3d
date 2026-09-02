import assert from "node:assert/strict";
import { GameplaySession } from "../scripts/api/session/GameplaySession.js";
import { MapWorld } from "../scripts/api/session/MapWorld.js";
import {
  singlePlayerSession,
  coopSession,
  deathmatchBotSession,
} from "../scripts/api/session/sessions.js";

// MapWorld.buildWorld() only needs a raycaster-shaped object for
// spawn-point resolution -- same fake used in entity-spawning.test.mjs.
// It never touches `game` itself in this phase, so a plain object is
// enough; attachView()/update() (Phaser-only) are intentionally not
// exercised here.
function fakeCreateRaycaster() {
  return {
    cellSize: 4,
    cellToWorld(cellX, cellY) {
      return { x: cellX * this.cellSize, y: cellY * this.cellSize };
    },
  };
}

// Builds the persistent GameplaySession (Gameplay/Rules/Users) and the
// current MapWorld together, since these tests only care about a single
// map's world -- see session-lifecycle.test.mjs for a test that spans
// two MapWorld instances off one GameplaySession.
function buildSession(sessionConfig) {
  const gameplaySession = new GameplaySession(sessionConfig);
  const world = new MapWorld(gameplaySession, {
    game: {},
    createRaycaster: fakeCreateRaycaster,
  });
  world.buildWorld();
  return world;
}

function testSinglePlayerSessionUsesAuthoredPlayerEntity() {
  const session = buildSession(singlePlayerSession);

  assert.equal(session.playerEntities.size, 1);
  const playerEntity = session.playerEntities.get("player-1");
  assert.ok(playerEntity, "should resolve the authored player entity by id");
  assert.equal(playerEntity.id, "player-1");

  // No "player" prefab spawn should have been needed -- the authored
  // entity from testEntities.js already satisfies it.
  assert.equal(
    session.entities.filter((e) => e.id === "player-1").length,
    1,
  );
}

function testCoopSessionSpawnsSecondPlayerDynamically() {
  const session = buildSession(coopSession);

  assert.equal(session.playerEntities.size, 2);
  const player1 = session.playerEntities.get("player-1");
  const player2 = session.playerEntities.get("player-2");

  assert.ok(player1, "player-1 should resolve to the authored entity");
  assert.ok(player2, "player-2 should be spawned dynamically, no authored entity for it");

  // Dynamically spawned via the "players" zone -- should have a resolved
  // MovementComponent position, not be missing one.
  const movement = player2.getComponent("MovementComponent");
  assert.ok(movement);
  assert.equal(typeof movement.x, "number");
  assert.equal(typeof movement.y, "number");
}

function testBotCountDrivesSpawnCountWithoutCodeChanges() {
  const countBots = (session) =>
    session.entities.filter((entity) => entity.id.startsWith("bot_")).length;

  const lowSession = buildSession({ ...deathmatchBotSession, botCount: 2 });
  const highSession = buildSession({ ...deathmatchBotSession, botCount: 6 });

  assert.equal(countBots(lowSession), 2);
  assert.equal(countBots(highSession), 6);
}

function testDeathmatchSessionHasNoAuthoredEntitiesOnlyPlayerAndBots() {
  const session = buildSession(deathmatchBotSession);

  // Bots are players controlled by AI, not a separate population --
  // playerEntities includes the human and every bot.
  assert.equal(session.playerEntities.size, 1 + deathmatchBotSession.botCount);
  assert.ok(session.playerEntities.get("player-1"));
  assert.equal(
    session.entities.length,
    1 + deathmatchBotSession.botCount, // player + bots, no authored entities
  );
}

function testBotsAreSpawnedAsPlayerEntitiesWithAIComponent() {
  const session = buildSession(deathmatchBotSession);

  // A bot is a player controlled by AI -- it must be a member of the
  // player population (playerEntities), not just present in the world.
  assert.equal(session.playerEntities.size, 1 + deathmatchBotSession.botCount);

  for (let i = 0; i < deathmatchBotSession.botCount; i++) {
    const bot = session.playerEntities.get(`bot_${i}`);
    assert.ok(bot, `bot_${i} should be a player entity`);
    assert.ok(
      bot.getComponent("AIComponent"),
      `bot_${i} should have an AIComponent -- it's AI-controlled, not a special entity type`,
    );
    assert.ok(bot.getComponent("HealthComponent"), "bots get the ordinary player prefab");
    assert.ok(bot.getComponent("InventoryComponent"), "bots get the ordinary player prefab");
  }
}

function testControllerAndTeamAreOrthogonal() {
  const session = buildSession(deathmatchBotSession);

  const human = session.playerEntities.get("player-1");
  const bot = session.playerEntities.get("bot_0");

  // Team assigns independently of controller.
  assert.equal(human.getComponent("ActorComponent").team, "red");
  assert.equal(bot.getComponent("ActorComponent").team, "blue");

  // Controller (AI vs none) is independent of team -- only the bot gets
  // an AIComponent, regardless of team assignment.
  assert.equal(human.getComponent("AIComponent"), undefined);
  assert.ok(bot.getComponent("AIComponent"));
}

function testSinglePlayerSessionHasNoBotsOrAIComponents() {
  // Sessions with no botCount/controller fields at all must behave
  // exactly as before -- controller defaults to "human" and nobody gets
  // an AIComponent.
  const session = buildSession(singlePlayerSession);

  const human = session.playerEntities.get("player-1");
  assert.equal(human.getComponent("AIComponent"), undefined);
  assert.equal(session.sessionPlayers.every((p) => p.controller === "human"), true);
}

function testSessionModifiersApplyToAllPlayersBotModifiersOnlyToBots() {
  const session = buildSession({
    gameMode: "deathmatch",
    map: "testMap",
    players: [{ id: "player-1" }],
    botCount: 1,
    modifiers: { healthMultiplier: 1.2 },
    botModifiers: { healthMultiplier: 1.5 },
  });

  const human = session.playerEntities.get("player-1");
  const bot = session.playerEntities.get("bot_0");

  // A human sees session.modifiers but never session.botModifiers.
  assert.equal(human.getComponent("HealthComponent").maximum, 120);
  // A bot's own modifiers override the session ones outright (150 =
  // 100 * 1.5) rather than compounding with them (which would be 180).
  assert.equal(bot.getComponent("HealthComponent").maximum, 150);
}

function testPlayerModifiersOverrideSessionModifiersButBotModifiersStillWinForBots() {
  const session = buildSession({
    gameMode: "deathmatch",
    map: "testMap",
    players: [{ id: "player-1", modifiers: { healthMultiplier: 2 } }],
    botCount: 1,
    modifiers: { healthMultiplier: 1.2 },
    botModifiers: { healthMultiplier: 1.5 },
  });

  const human = session.playerEntities.get("player-1");
  const bot = session.playerEntities.get("bot_0");

  // This player's own modifiers win over the session-wide ones.
  assert.equal(human.getComponent("HealthComponent").maximum, 200);
  // The bot has no player-level override of its own; session.modifiers
  // still gets overridden by session.botModifiers for it.
  assert.equal(bot.getComponent("HealthComponent").maximum, 150);
}

function testBotsWithNoStateDoNotCrashAndGetNoResourceComponent() {
  // Regression: bots have no `state` at all (resolveSessionPlayers()
  // never gives them one) -- buildWorld() must not assume every player
  // has `state.resources` to read.
  const session = buildSession(deathmatchBotSession);

  const bot = session.playerEntities.get("bot_0");
  assert.ok(bot, "buildWorld() must not throw for a stateless bot");
  assert.equal(bot.getComponent("ResourceComponent"), undefined);
}

const tests = [
  [
    "singlePlayerSession resolves the authored player entity, no dynamic spawn",
    testSinglePlayerSessionUsesAuthoredPlayerEntity,
  ],
  [
    "coopSession spawns the second player dynamically via the players zone",
    testCoopSessionSpawnsSecondPlayerDynamically,
  ],
  [
    "changing botCount changes spawned bot count with no code changes",
    testBotCountDrivesSpawnCountWithoutCodeChanges,
  ],
  [
    "deathmatchBotSession has no authored entities, only player + bots",
    testDeathmatchSessionHasNoAuthoredEntitiesOnlyPlayerAndBots,
  ],
  [
    "bots are spawned as player entities with an AIComponent",
    testBotsAreSpawnedAsPlayerEntitiesWithAIComponent,
  ],
  [
    "controller and team are orthogonal on player entities",
    testControllerAndTeamAreOrthogonal,
  ],
  [
    "singlePlayerSession has no bots or AIComponents",
    testSinglePlayerSessionHasNoBotsOrAIComponents,
  ],
  [
    "session modifiers apply to all players, botModifiers only to bots",
    testSessionModifiersApplyToAllPlayersBotModifiersOnlyToBots,
  ],
  [
    "player modifiers override session modifiers, botModifiers still wins for bots",
    testPlayerModifiersOverrideSessionModifiersButBotModifiersStillWinForBots,
  ],
  [
    "bots with no state don't crash and get no ResourceComponent",
    testBotsWithNoStateDoNotCrashAndGetNoResourceComponent,
  ],
];

for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}

console.log(`\n${tests.length} game session tests passed.`);
