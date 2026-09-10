import { ServiceLocator } from "../../services/ServiceLocator.js";

export const GameplayState = Object.freeze({
  IDLE: "idle",
  ACTIVE: "active",
  PAUSED: "paused",
  GAME_OVER: "game_over",
});

export class Gameplay {
  constructor({ rules, onGameOver } = {}) {
    if (!rules) {
      throw new Error("Gameplay requires a rules implementation");
    }

    ServiceLocator.register("system", "GameplayManager", this);

    this.rules = rules;
    this.onGameOver = onGameOver;

    this.hud = null;

    // Game-level state
    this.state = GameplayState.IDLE;
    this.map = null;
    this.outcome = null;

    // Shared gameplay concepts.
    // Individual rules may use whichever are relevant.
    this.players = [];
    this.teams = [];
    this.score = {};
    this.lives = {};
    this.objectives = [];

    // Messages received during the current processing cycle.
    this.messages = [];

    // Requests produced by rules for the game/world layer.
    this.actions = [];
  }

  setHud(hud) {
    this.hud = hud;
  }

  clearHud() {
    this.hud = null;
  }

  start() {
    if (this.state !== GameplayState.IDLE) return;

    this.state = GameplayState.ACTIVE;
    this.outcome = null;

    this.rules.onStart?.(this);
  }

  update(dt) {
    if (this.state !== GameplayState.ACTIVE) return;

    this.rules.update?.(this, dt);
  }

  process(messages) {
    if (messages.length === 0) return;

    // messages = messages;

    for (const message of messages) {
      this.dispatch(message);
    }

    this.messages.length = 0;
  }

  dispatch(message) {
    const handler = this.rules.events?.[message.type];

    if (!handler) return;

    const method = this.rules[handler];

    if (typeof method === "function") {
      method.call(this.rules, this, message);
    }
  }

  loadMap(map) {
    this.map = map;
    this.objectives = [];

    this.rules.onMapLoaded?.(this, map);
  }

  finish(outcome = {}) {
    this.outcome = outcome;
    this.state = GameplayState.GAME_OVER;

    this.rules.onGameOver?.(this, outcome);
    this.onGameOver?.(outcome);
  }

  pause() {
    if (this.state === GameplayState.ACTIVE) {
      this.state = GameplayState.PAUSED;
    }
  }

  resume() {
    if (this.state === GameplayState.PAUSED) {
      this.state = GameplayState.ACTIVE;
    }
  }

  addAction(action) {
    this.actions.push(action);
  }

  consumeActions() {
    const actions = this.actions;
    this.actions = [];
    return actions;
  }

  addPlayer(player) {
    this.players.push(player);
    return player;
  }

  getPlayer(id) {
    return this.players.find((player) => player.id === id) || null;
  }
}
