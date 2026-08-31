import assert from "node:assert/strict";
import { Gameplay, GameplayState } from "../scripts/api/rules/Gameplay.js";
import { SinglePlayerRules } from "../scripts/api/rules/SinglePlayerRules.js";
import { MultiplayerRules } from "../scripts/api/rules/MultiplayerRules.js";

function noopRules() {
  return {
    onStart() {},
    onMapLoaded() {},
    update() {},
    process() {},
    onMapComplete() {},
  };
}

function testGameplayInitialState() {
  const gameplay = new Gameplay({ rules: noopRules() });

  assert.equal(gameplay.state, GameplayState.IDLE);
  assert.deepEqual(gameplay.players, []);
  assert.deepEqual(gameplay.teams, []);
  assert.deepEqual(gameplay.objectives, []);
  assert.equal(gameplay.outcome, null);
  assert.equal(gameplay.map, null);
}

function testGameplayStart() {
  let started = false;
  const gameplay = new Gameplay({
    rules: { ...noopRules(), onStart: () => (started = true) },
  });

  gameplay.start();

  assert.equal(gameplay.state, GameplayState.ACTIVE);
  assert.ok(started);
}

function testGameplayProcessDelegatesToRules() {
  const received = [];
  const gameplay = new Gameplay({
    rules: { ...noopRules(), process: (_gp, messages) => received.push(...messages) },
  });

  gameplay.start();
  gameplay.process([{ type: "player.died", playerId: "player-1" }]);

  assert.equal(received.length, 1);
  assert.equal(gameplay.messages.length, 1);
}

function testGameplayLoadMap() {
  let loadedMap = null;
  const gameplay = new Gameplay({
    rules: { ...noopRules(), onMapLoaded: (gp) => (loadedMap = gp.map) },
  });

  gameplay.loadMap("map01");

  assert.equal(gameplay.map, "map01");
  assert.equal(loadedMap, "map01");
  assert.deepEqual(gameplay.objectives, []);
}

function testGameplayFinish() {
  const gameplay = new Gameplay({ rules: noopRules() });

  gameplay.start();
  gameplay.finish({ result: "completed" });

  assert.equal(gameplay.state, GameplayState.FINISHED);
  assert.deepEqual(gameplay.outcome, { result: "completed" });
}

function testGameplayReset() {
  const gameplay = new Gameplay({ rules: noopRules() });

  gameplay.start();
  gameplay.loadMap("map01");
  gameplay.finish({ result: "completed" });
  gameplay.reset();

  assert.equal(gameplay.state, GameplayState.IDLE);
  assert.equal(gameplay.map, null);
  assert.equal(gameplay.outcome, null);
  assert.deepEqual(gameplay.messages, []);
}

function testSinglePlayerObjectiveCompletionUpdatesProgress() {
  const gameplay = new Gameplay({
    rules: new SinglePlayerRules({
      maps: ["map01"],
      objectives: [{ id: "find-key" }, { id: "find-map" }],
    }),
  });

  gameplay.start();
  assert.equal(gameplay.objectives.length, 2);
  assert.ok(gameplay.objectives.every((objective) => !objective.completed));

  gameplay.process([{ type: "objective.completed", objectiveId: "find-key" }]);

  assert.equal(gameplay.objectives[0].completed, true);
  assert.equal(gameplay.objectives[1].completed, false);
  assert.equal(gameplay.state, GameplayState.ACTIVE);
}

function testSinglePlayerExitCompletesMapWithoutObjectives() {
  const gameplay = new Gameplay({
    rules: new SinglePlayerRules({ maps: ["map01", "map02"] }),
  });

  gameplay.start();
  assert.equal(gameplay.map, "map01");

  gameplay.process([
    { type: "interaction.completed", actorId: "player-1", targetId: "exit" },
  ]);

  assert.equal(gameplay.map, "map02");
  assert.equal(gameplay.state, GameplayState.ACTIVE);
}

function testSinglePlayerFinishesAfterLastMap() {
  const gameplay = new Gameplay({
    rules: new SinglePlayerRules({ maps: ["map01"] }),
  });

  gameplay.start();
  gameplay.process([
    { type: "interaction.completed", actorId: "player-1", targetId: "exit" },
  ]);

  assert.equal(gameplay.state, GameplayState.FINISHED);
  assert.deepEqual(gameplay.outcome, { result: "completed" });
}

function testMultiplayerKillIncreasesKillerScore() {
  const gameplay = new Gameplay({
    rules: new MultiplayerRules({ maps: ["arena01"], scoreLimit: 10 }),
  });

  gameplay.start();
  gameplay.process([
    { type: "entity.killed", killerId: "player-1", entityId: "player-2" },
  ]);

  assert.equal(gameplay.score["player-1"], 1);
}

function testMultiplayerFinishesAtScoreLimit() {
  const gameplay = new Gameplay({
    rules: new MultiplayerRules({ maps: ["arena01"], scoreLimit: 2 }),
  });

  gameplay.start();
  gameplay.process([
    { type: "entity.killed", killerId: "player-1", entityId: "player-2" },
  ]);
  assert.equal(gameplay.state, GameplayState.ACTIVE);

  gameplay.process([
    { type: "entity.killed", killerId: "player-1", entityId: "player-2" },
  ]);

  assert.equal(gameplay.state, GameplayState.FINISHED);
  assert.equal(gameplay.outcome.winnerId, "player-1");
}

function testMultiplayerScoreLimitConfigurationChangesBehaviour() {
  const lowLimitMessages = [
    { type: "entity.killed", killerId: "player-1", entityId: "player-2" },
    { type: "entity.killed", killerId: "player-1", entityId: "player-2" },
  ];

  const lowLimitGameplay = new Gameplay({
    rules: new MultiplayerRules({ maps: ["arena01"], scoreLimit: 2 }),
  });
  lowLimitGameplay.start();
  lowLimitGameplay.process(lowLimitMessages);
  assert.equal(lowLimitGameplay.state, GameplayState.FINISHED);

  const highLimitGameplay = new Gameplay({
    rules: new MultiplayerRules({ maps: ["arena01"], scoreLimit: 20 }),
  });
  highLimitGameplay.start();
  highLimitGameplay.process(lowLimitMessages);
  assert.equal(highLimitGameplay.state, GameplayState.ACTIVE);
}

const tests = [
  ["gameplay starts in the expected state", testGameplayInitialState],
  ["gameplay can start", testGameplayStart],
  ["gameplay can process messages", testGameplayProcessDelegatesToRules],
  ["gameplay can load a map", testGameplayLoadMap],
  ["gameplay can finish", testGameplayFinish],
  ["gameplay can reset", testGameplayReset],
  [
    "single-player objective completion updates progress",
    testSinglePlayerObjectiveCompletionUpdatesProgress,
  ],
  [
    "single-player exit completes map without objectives",
    testSinglePlayerExitCompletesMapWithoutObjectives,
  ],
  [
    "single-player finishes after last map",
    testSinglePlayerFinishesAfterLastMap,
  ],
  [
    "multiplayer kill increases killer score",
    testMultiplayerKillIncreasesKillerScore,
  ],
  ["multiplayer finishes at score limit", testMultiplayerFinishesAtScoreLimit],
  [
    "multiplayer score limit configuration changes behaviour",
    testMultiplayerScoreLimitConfigurationChangesBehaviour,
  ],
];

for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}

console.log(`\n${tests.length} gameplay rules tests passed.`);
