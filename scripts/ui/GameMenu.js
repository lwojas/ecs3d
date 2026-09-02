import { GAME_MODES } from "../api/session/createRulesForSession.js";
import {
  getAvailableMaps,
  getAvailableEntityDatasets,
} from "../api/session/sessions.js";
import { itemData } from "../system/ItemSystem.js/itemData.js";
import { resourceData } from "../system/resourceData.js";

// The starting loadout new player rows get -- mirrors sessions.js's
// createTestPlayerState(), minus `health`/`ammo` (present in that
// function but never read by any code path, so not worth resurrecting
// here -- see MapWorld.buildWorld(), which only ever consumes
// user.state.inventory and user.state.resources).
const DEFAULT_LOADOUT = {
  items: ["pistol", "shotgun", "flamethrower"],
  equipped: "shotgun",
  resources: { plasma: 150 },
};

// Turns a registry key like "testMap" into a human label ("Test Map").
function humanize(key) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function optionsHtml(values, { withNone = false, noneLabel = "None" } = {}) {
  const none = withNone ? `<option value="">${noneLabel}</option>` : "";
  return (
    none +
    values
      .map((value) => `<option value="${value}">${humanize(value)}</option>`)
      .join("")
  );
}

// GAME_MODES already carries its own {value, label} pairs -- unlike the
// map/entity registries (plain string keys), so it skips humanize().
function gameModeOptionsHtml(modes) {
  return modes
    .map((mode) => `<option value="${mode.value}">${mode.label}</option>`)
    .join("");
}

// The valid inventory items are whatever itemData.js defines -- the
// same registry InventorySystem/ItemSystem already resolve item ids
// against -- so a new weapon there shows up here automatically.
function loadoutItemsHtml(selectedItems) {
  return Object.keys(itemData)
    .map(
      (id) => `
        <label class="loadout-item-toggle">
          <input type="checkbox" class="loadout-item" value="${id}" ${
            selectedItems.includes(id) ? "checked" : ""
          } /> ${humanize(id)}
        </label>
      `,
    )
    .join("");
}

// One number input per known resource type -- new resource types show up
// here automatically, the same way loadoutItemsHtml() picks up new
// weapons from itemData without this file changing.
function loadoutResourcesHtml(resources) {
  return Object.entries(resourceData)
    .map(
      ([id, def]) => `
        <label>${def.label ?? humanize(id)}
          <input type="number" class="loadout-resource" data-resource="${id}" min="0" step="${def.step ?? 10}" value="${resources[id] ?? 0}" />
        </label>
      `,
    )
    .join("");
}

function loadoutEquippedOptionsHtml(equipped) {
  const options = Object.keys(itemData)
    .map(
      (id) =>
        `<option value="${id}" ${equipped === id ? "selected" : ""}>${humanize(id)}</option>`,
    )
    .join("");
  return `<option value="">None</option>${options}`;
}

// A plain DOM/vanilla-JS menu -- no framework, no render loop. It only
// ever touches the DOM in response to a user event (add/remove player,
// change mode, click start); once built, an idle menu costs nothing to
// leave open, and `hidden` costs nothing while gameplay runs.
//
// It only ever *produces* a sessionConfig object matching the existing
// contract (see sessions.js) and hands it to `onStart` -- it never
// constructs Gameplay/GameplaySession/entities itself. That remains the
// application layer's job (see boot.js).
export class GameMenu {
  constructor(root, { onStart }) {
    this.root = root;
    this.onStart = onStart;
    this.nextPlayerNumber = 1;

    root.innerHTML = this.renderShell();

    this.modeSelect = root.querySelector('[data-field="gameMode"]');
    this.playerRows = root.querySelector("[data-player-rows]");
    this.rulesDeathmatch = root.querySelector("[data-rules-deathmatch]");
    this.rulesWave = root.querySelector("[data-rules-wave]");
    this.rulesEmpty = root.querySelector("[data-rules-empty]");
    this.botModifiersPanel = root.querySelector("[data-bot-modifiers-panel]");

    root.addEventListener("click", (event) => this.handleClick(event));
    root.addEventListener("change", (event) => this.handleChange(event));

    this.addPlayerRow({
      name: "Player 1",
      controller: "human",
      team: "",
      ...DEFAULT_LOADOUT,
    });
    this.updateRulesVisibility();
    this.updateBotModifiersVisibility();
  }

  renderShell() {
    return `
      <div class="menu-panel">
        <h1>Game Setup</h1>

        <section class="panel">
          <h2>Session</h2>
          <div class="field-group">
            <label>Game mode
              <select data-field="gameMode">${gameModeOptionsHtml(GAME_MODES)}</select>
            </label>
            <label>Map
              <select data-field="map">${optionsHtml(getAvailableMaps())}</select>
            </label>
            <label>Entity dataset
              <select data-field="entities">${optionsHtml(
                getAvailableEntityDatasets(),
                { withNone: true, noneLabel: "None (dynamic spawn only)" },
              )}</select>
            </label>
          </div>
        </section>

        <section class="panel">
          <h2>Players</h2>
          <div class="player-rows" data-player-rows></div>
          <button type="button" class="btn-secondary" data-action="add-player">+ Add Player</button>
        </section>

        <section class="panel">
          <h2>Rules</h2>
          <div class="rule-field" data-rules-deathmatch>
            <label>Score limit
              <input type="number" min="1" step="1" data-field="scoreLimit" value="10" />
            </label>
          </div>
          <div class="rule-field" data-rules-wave>
            <label>Enemy wave count
              <input type="number" min="1" step="1" data-field="waveCount" value="3" />
            </label>
          </div>
          <p class="hint" data-rules-empty>No configurable rules for this mode.</p>
        </section>

        <section class="panel" data-bot-modifiers-panel>
          <h2>Bot Modifiers</h2>
          <label>Health multiplier
            <input type="number" min="0.1" step="0.1" data-field="healthMultiplier" value="1.5" />
          </label>
        </section>

        <button type="button" class="btn-primary" data-action="start">Start Game</button>
      </div>
    `;
  }

  renderPlayerRow({ id, name, controller, team, items, equipped, resources = {} }) {
    const group = document.createElement("div");
    group.className = "player-row-group";
    group.dataset.playerRow = "";
    group.dataset.id = id;
    group.innerHTML = `
      <div class="player-row">
        <input type="text" class="player-name" value="${name}" />
        <select class="player-controller">
          <option value="human" ${controller === "human" ? "selected" : ""}>Human</option>
          <option value="bot" ${controller === "bot" ? "selected" : ""}>Bot</option>
        </select>
        <select class="player-team">
          <option value="" ${team === "" ? "selected" : ""}>No team</option>
          <option value="red" ${team === "red" ? "selected" : ""}>Red</option>
          <option value="blue" ${team === "blue" ? "selected" : ""}>Blue</option>
        </select>
        <button type="button" class="btn-remove" data-action="remove-player">Remove</button>
      </div>
      <details class="player-loadout">
        <summary>Loadout</summary>
        <div class="loadout-items">${loadoutItemsHtml(items)}</div>
        <label>Equipped
          <select class="loadout-equipped">${loadoutEquippedOptionsHtml(equipped)}</select>
        </label>
        ${loadoutResourcesHtml(resources)}
      </details>
    `;
    return group;
  }

  addPlayerRow(defaults) {
    const id = `player-${this.nextPlayerNumber++}`;
    const row = this.renderPlayerRow({ id, ...defaults });
    this.playerRows.appendChild(row);
  }

  handleClick(event) {
    const action = event.target.dataset.action;
    if (!action) return;

    if (action === "add-player") {
      const count = this.playerRows.children.length + 1;
      this.addPlayerRow({
        name: `Player ${count}`,
        controller: "human",
        team: "",
        ...DEFAULT_LOADOUT,
      });
      this.updateBotModifiersVisibility();
    } else if (action === "remove-player") {
      event.target.closest("[data-player-row]")?.remove();
      this.updateBotModifiersVisibility();
    } else if (action === "start") {
      this.onStart(this.buildSessionConfig());
    }
  }

  handleChange(event) {
    if (event.target === this.modeSelect) {
      this.updateRulesVisibility();
    } else if (event.target.classList.contains("player-controller")) {
      this.updateBotModifiersVisibility();
    }
  }

  updateRulesVisibility() {
    const mode = this.modeSelect.value;
    this.rulesDeathmatch.hidden = mode !== "deathmatch";
    this.rulesWave.hidden = mode !== "wave";
    this.rulesEmpty.hidden = mode === "deathmatch" || mode === "wave";
  }

  updateBotModifiersVisibility() {
    const hasBots = [
      ...this.playerRows.querySelectorAll(".player-controller"),
    ].some((select) => select.value === "bot");
    this.botModifiersPanel.hidden = !hasBots;
  }

  // Reads the current DOM state and produces the plain serializable
  // sessionConfig object the rest of the app already understands (see
  // sessions.js for the contract this must match).
  buildSessionConfig() {
    const gameMode = this.modeSelect.value;
    const map = this.root.querySelector('[data-field="map"]').value;
    const entities = this.root.querySelector('[data-field="entities"]').value;

    const players = [
      ...this.playerRows.querySelectorAll("[data-player-row]"),
    ].map((row) => {
      const name = row.querySelector(".player-name").value.trim();
      const controller = row.querySelector(".player-controller").value;
      const team = row.querySelector(".player-team").value;
      const player = {
        id: row.dataset.id,
        name: name || row.dataset.id,
        controller,
      };
      if (team) player.team = team;

      // Loadout -> the same state.inventory/state.resources shape
      // MapWorld.buildWorld() already reads off the persistent User
      // (see createTestPlayerState() in sessions.js).
      const items = [...row.querySelectorAll(".loadout-item:checked")].map(
        (checkbox) => checkbox.value,
      );
      const equipped = row.querySelector(".loadout-equipped").value;
      if (equipped && !items.includes(equipped)) items.push(equipped);

      const resources = {};
      row.querySelectorAll(".loadout-resource").forEach((input) => {
        const amount = Number(input.value);
        if (amount > 0) resources[input.dataset.resource] = amount;
      });

      const state = {};
      if (items.length > 0) {
        state.inventory = equipped ? { items, equipped } : { items };
      }
      if (Object.keys(resources).length > 0) {
        state.resources = resources;
      }
      if (Object.keys(state).length > 0) player.state = state;

      return player;
    });

    const config = { gameMode, map, players };
    if (entities) config.entities = entities;

    const rules = {};
    if (gameMode === "deathmatch") {
      rules.scoreLimit = Number(
        this.root.querySelector('[data-field="scoreLimit"]').value,
      );
    } else if (gameMode === "wave") {
      // Composition only (what/how many) -- *where* a wave spawns is a
      // runtime decision WaveRules makes for itself (see WaveRules.js);
      // the menu has no business picking a map-specific zone name.
      rules.waves = [
        {
          prefab: "enemy",
          count: Number(
            this.root.querySelector('[data-field="waveCount"]').value,
          ),
        },
      ];
    }
    if (Object.keys(rules).length > 0) config.rules = rules;

    if (players.some((player) => player.controller === "bot")) {
      const healthMultiplier = Number(
        this.root.querySelector('[data-field="healthMultiplier"]').value,
      );
      if (healthMultiplier && healthMultiplier !== 1) {
        config.botModifiers = { healthMultiplier };
      }
    }

    return config;
  }

  show() {
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }
}
