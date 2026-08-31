import { GameRules } from "./GameRules.js";

// A minimal multiplayer ruleset: score is tracked per player id, and a
// map/round rotates on a score limit, a time limit, or when maps run out.
// No networking or synchronization -- purely rules/state.
export class MultiplayerRules extends GameRules {
  constructor({
    maxPlayers = 8,
    rounds = 1,
    timeLimit = null,
    scoreLimit = null,
    maps = [],
  } = {}) {
    super();
    this.maxPlayers = maxPlayers;
    this.rounds = rounds;
    this.timeLimit = timeLimit;
    this.scoreLimit = scoreLimit;
    this.maps = maps;
    this.mapIndex = 0;
    this.round = 1;
    this.elapsed = 0;
  }

  onStart(gameplay) {
    this.mapIndex = 0;
    this.round = 1;
    this.elapsed = 0;
    gameplay.score = {};

    if (this.maps.length > 0) {
      gameplay.loadMap(this.maps[this.mapIndex]);
    }
  }

  update(gameplay, dt) {
    if (this.timeLimit == null) return;

    this.elapsed += dt;
    if (this.elapsed >= this.timeLimit) {
      this.onMapComplete(gameplay);
    }
  }

  process(gameplay, messages) {
    for (const message of messages) {
      if (message.type === "entity.killed" && message.killerId) {
        gameplay.score[message.killerId] =
          (gameplay.score[message.killerId] || 0) + 1;
      }
    }

    if (this.scoreLimit != null && this.hasReachedScoreLimit(gameplay)) {
      this.onMapComplete(gameplay);
    }
  }

  hasReachedScoreLimit(gameplay) {
    return Object.values(gameplay.score).some(
      (points) => points >= this.scoreLimit,
    );
  }

  onMapComplete(gameplay) {
    this.elapsed = 0;
    this.mapIndex += 1;

    if (this.mapIndex < this.maps.length) {
      gameplay.loadMap(this.maps[this.mapIndex]);
      return;
    }

    if (this.round < this.rounds) {
      this.round += 1;
      this.mapIndex = 0;
      gameplay.loadMap(this.maps[0]);
      return;
    }

    gameplay.finish({
      winnerId: this.getLeader(gameplay),
      score: { ...gameplay.score },
    });
  }

  getLeader(gameplay) {
    let leaderId = null;
    let bestScore = -Infinity;

    for (const [playerId, points] of Object.entries(gameplay.score)) {
      if (points > bestScore) {
        bestScore = points;
        leaderId = playerId;
      }
    }

    return leaderId;
  }
}
