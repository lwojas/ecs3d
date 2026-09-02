# Session / Gameplay Orchestration

This document explains how a game session gets configured, started,
played, and torn down in this codebase — the layer that sits **above**
the ECS/renderer (see `readme.md` for the raycaster/renderer roadmap;
this file is about everything that decides *what* gets rendered and
*when*, not how it's rendered).

It exists so both humans and agents can quickly answer: *"which file
owns this responsibility, and in what order do these classes get
constructed/destroyed?"* without re-deriving it from scratch.

---

## The one rule that explains most of the architecture

> **Gameplay/session state must survive Phaser state transitions, and
> must never be owned by an individual Phaser map state.**

Everything else — the split between `GameplaySession` and `MapWorld`,
why the HTML menu never touches ECS objects, why `boot.js` is the only
place that constructs a `GameplaySession` — follows from that one rule.
If a change requires a Phaser state to reconstruct the menu, or the menu
to import `Gameplay`/`EntitySpawner`/etc. directly, it's breaking this
rule.

---

## High-level flow

```text
index.html
  #game-menu (HTML/CSS/vanilla JS)      #game-container (Phaser canvas)
        |                                       |
        v                                       |
  scripts/ui/GameMenu.js                        |
    - renders Game Setup UI                     |
    - reads from sessions.js /                  |
      createRulesForSession.js registries       |
    - produces a plain sessionConfig object      |
    - never constructs Gameplay/GameplaySession  |
        |                                       |
        | onStart(sessionConfig)                |
        v                                       |
  scripts/boot.js  (the "application" layer) ----+
    - new GameplaySession(sessionConfig)
    - game.state.start(<state for this gameMode>)
        |
        v
  GameplaySession (scripts/api/session/GameplaySession.js)
    - persistent: rules + Gameplay + Users
    - registers itself in ServiceLocator
        |
        v
  Phaser state (SinglePlayerWhiteroom / MultiplayerWhiteroom)
    - resolves the GameplaySession via ServiceLocator
    - builds a MapWorld on top of it
        |
        v
  MapWorld (scripts/api/session/MapWorld.js)
    - per-map: map/entity data, raycaster, EntityManager,
      EntitySpawner, ECS systems, HUD, camera, input
    - buildWorld() -> attachView() -> update() each frame
        |
        v
   Phaser canvas renders gameplay
```

Returning to the menu (Escape key, wired in `boot.js`) reverses the
bottom half: the current Phaser state's `shutdown()` tears down its
`MapWorld`, `game.state.start("Menu")` swaps in a blank Phaser state,
and `gameMenu.show()` un-hides the HTML menu. `GameplaySession` itself
is not explicitly destroyed — the next "Start Game" click simply
constructs a new one, which overwrites the old one's `ServiceLocator`
registration.

---

## Key concepts and the files that own them

| Concept | File | Responsibility |
|---|---|---|
| **Application layer** | `scripts/boot.js` | The only place that turns a `sessionConfig` into `new GameplaySession(...)` + `game.state.start(...)`. Owns the menu↔gameplay transition (Escape key → `returnToMenu()`). Registers Phaser states. |
| **Menu UI** | `scripts/ui/GameMenu.js`, `scripts/ui/game-menu.css` | Plain DOM/vanilla JS. Renders the Game Setup form, reads the game-mode/map/entity-dataset registries, and *produces* a `sessionConfig` object — never constructs gameplay objects itself. Purely event-driven (no render loop, no polling); `hidden` costs nothing while gameplay runs. |
| **Session contract** | `scripts/api/session/sessions.js` | Defines the shape of a `sessionConfig` (see below), the `maps`/`entityDatasets` registries (generated — see Data pipeline), and helpers: `resolveMapData`, `resolveEntityData`, `resolveSessionPlayers` (expands `botCount` shorthand into ordinary player entries), `getAvailableMaps`, `getAvailableEntityDatasets`. |
| **Rules factory** | `scripts/api/session/createRulesForSession.js` | The one `switch` that maps `sessionConfig.gameMode` to a `GameRules` subclass. Exports `GAME_MODES` — the canonical list the menu reads instead of hardcoding mode names. |
| **Persistent session** | `scripts/api/session/GameplaySession.js` | Constructed **once per session** (by `boot.js`). Owns whatever must survive a map transition: the `Gameplay` orchestrator, the resolved `GameRules` instance, and one persistent `User` per player. Registers itself in `ServiceLocator` as `("system", "GameplaySession")`. |
| **Gameplay orchestrator** | `scripts/api/rules/Gameplay.js` | Holds `state` (idle/active/paused/game_over), `players`, `score`, dispatches ECS messages to the active `GameRules`'s `events` map, and exposes an actions queue (e.g. `player.respawn`) for the map layer to drain. |
| **Rules classes** | `scripts/api/rules/{GameRules,SinglePlayerRules,MultiplayerRules,WaveRules}.js` | Game-mode-specific behaviour: respawn logic (`SinglePlayerRules`), score/round limits (`MultiplayerRules` = "deathmatch"), wave spawning (`WaveRules`). `attachWorld()`/`detachWorld()` is the seam a rule uses to reach the *current* map's `EntitySpawner`/`mapData` without holding a reference across a map transition. `onMapLoaded(gameplay, map)` (not `onStart()`) is where a rule should put *per-map* logic — `Gameplay.loadMap()` calls it on every map load, whereas `Gameplay.start()` only ever fires `onStart()` once per session (a no-op on every map after the first). `WaveRules` also owns *where* a wave spawns: `resolveSpawnZone(wave)` picks `wave.spawnZone` (a legitimate per-wave authoring override) or falls back to `this.defaultSpawnZone` (the rule's own convention, defaulting to `"courtyard"`, overridable via `rules.defaultSpawnZone`) — see "Where a decision belongs" below for why this doesn't live in the menu or on map data. |
| **Persistent player state** | `scripts/api/rules/User.js` | One per player, owned by `Gameplay`. Carries `state` (inventory/resources — see `createTestPlayerState()` in `sessions.js`) across map transitions; `bindEntity`/`unbindEntity` tracks which ECS entity currently represents it. |
| **Runtime entity registry** | `scripts/services/EntityManager.js` | The one authoritative collection of live ECS entities (`world`, plus an id index). Every spawn path — authored entities, players, bots, and anything a `GameRules` subclass spawns at runtime (e.g. `WaveRules`) — goes through `EntitySpawner` → `PrefabFactory.createEntity()` → `EntityManager.addEntity()`, so `getEntity(id)` finds all of them uniformly regardless of who spawned them. Nothing else keeps a second id-keyed store that must be manually kept in sync. |
| **Per-map world** | `scripts/api/session/MapWorld.js` | Constructed fresh **every map load**, given a `GameplaySession` to read config/rules/gameplay from. Owns the raycaster, `EntityManager`, `EntitySpawner`, ECS systems, HUD, camera, and input — i.e. everything that must *not* survive a map transition. `buildWorld()` (map/entity resolution + spawning, no Phaser dependency) is split from `attachView()` (HUD/camera/input, Phaser-only) so the former is unit-testable — see `tests/game-session.test.mjs`, `tests/session-lifecycle.test.mjs`. `MapWorld.entities`/`getEntity(id)` are read-only facades that delegate to `this.entityManager` — not a second runtime store. |
| **Phaser states** | `scripts/level-singleplayer-whiteroom.js`, `scripts/level-multiplayer-whiteroom.js` | Thin hosts. `create()` resolves the existing `GameplaySession` via `ServiceLocator` (never constructs one), builds a `MapWorld`, calls `.start()`. `update()`/`shutdown()` just forward to the `MapWorld`. `scripts/boot.js` also registers a blank `"Menu"` state (idle while the HTML menu is visible) and `"Boot"` (asset preload, runs once). `scripts/level-whiteroom.js` is a pre-refactor rollback path, kept but not part of this flow. |
| **Service lookup** | `scripts/services/ServiceLocator.js` | A `{system, game}` two-category map. `GameplaySession`/`Gameplay` register themselves here; Phaser states resolve them here instead of receiving them via constructor args (Phaser's `state.add`/`state.start` API doesn't have a clean way to inject them). |
| **Data pipeline** | `tools/build-data.js`, `scripts/data/{maps,entities,templates}/` | The editor exports JSON. `npm run data:build` (or `npm start`, via `prestart`) scans those three folders and generates a `export default {...}` `.js` sibling per JSON file, plus `index.js` registries in `maps/` and `entities/` (`{ maps }` / `{ entityDatasets }`) that `sessions.js` imports. Adding a new map/entity set needs **no code changes** — just the JSON file plus a re-run of the script. |

---

## The `sessionConfig` contract

This is the one plain, serializable object that flows from the menu (or
a hand-written fixture) into `GameplaySession`. See the field-by-field
comment block at the top of `scripts/api/session/sessions.js` for the
authoritative version; summary:

```js
{
  gameMode: "deathmatch",   // -> createRulesForSession() picks the GameRules class
  map: "testMap",           // -> resolveMapData()
  entities: "testEntities", // optional -> resolveEntityData(); omitted = no authored entities

  players: [
    {
      id: "player-1",
      name: "Player 1",
      controller: "human",  // or "bot"
      team: "red",          // optional
      state: {              // optional; carried on the persistent User
        inventory: { items: ["pistol", "shotgun"], equipped: "shotgun" },
        resources: { plasma: 150 },
      },
    },
  ],

  botCount: 3,        // optional shorthand, expanded by resolveSessionPlayers()
  botTeam: "blue",    // team for bots expanded from botCount

  rules: { scoreLimit: 10 },            // passed straight to the GameRules constructor
  botModifiers: { healthMultiplier: 1.5 }, // bot-only, layered on top of `modifiers`
}
```

A bot is a **player controlled by AI**, not a separate entity
population — `controller: "bot"` on an ordinary player entry (whether
authored explicitly or expanded from `botCount`) is the only thing that
distinguishes it. Both paths are folded into one flat roster by
`resolveSessionPlayers()` before `MapWorld` ever sees them.

---

## Lifecycle walkthrough

1. **Page load.** `index.html` loads `scripts/init.js` (constructs
   `Phaser.Game(..., "game-container")`) and `scripts/boot.js`
   (`type="module"`, deferred). `window.onload` in `boot.js` builds the
   `GameMenu` into `#game-menu`, wires the Escape-key listener, and
   starts the `"Boot"` Phaser state.
2. **Boot state.** Preloads textures/sprites once, then
   `game.state.start("Menu")` — a blank Phaser state, kept separate
   from `"Boot"` so returning to the menu later doesn't re-run
   `preload()`.
3. **Menu interaction.** All in `GameMenu.js`, purely event-driven:
   add/remove player rows, toggle rule fields per game mode, expand a
   player's Loadout `<details>`. Nothing here touches Phaser, ECS, or
   `ServiceLocator`.
4. **"Start Game" clicked.** `GameMenu.buildSessionConfig()` reads the
   DOM and returns a `sessionConfig` object, handed to the `onStart`
   callback `boot.js` provided — `startGameplay(sessionConfig)`.
5. **`startGameplay()`** (in `boot.js`):
   - `new GameplaySession(sessionConfig)` — this constructs
     `createRulesForSession(sessionConfig)` (picks the `GameRules`
     subclass), `new Gameplay({ rules })`, and one `User` per resolved
     player; registers itself in `ServiceLocator`.
   - `gameMenu.hide()`.
   - `game.state.start(<"MultiplayerWhiteroom" for deathmatch, "SinglePlayerWhiteroom" otherwise>)`.
6. **Phaser state `create()`.** Resolves the just-built
   `GameplaySession` via `ServiceLocator.resolve("system", "GameplaySession")`,
   constructs `new MapWorld(gameplaySession, { game: this.game })`, calls
   `world.start()` → `buildWorld()` (resolve map/entities, build
   `EntityManager`/`EntitySpawner`/raycaster, spawn authored entities,
   resolve+spawn/hydrate each player from `resolveSessionPlayers()`,
   `rules.attachWorld(...)`, then `gameplay.loadMap()` — fires
   `rules.onMapLoaded()` on *every* map load, e.g. `WaveRules` spawns its
   waves here — followed by `gameplay.start()` — fires `rules.onStart()`,
   but only once per session, a no-op on every map after the first) then
   `attachView()` (HUD, camera, input, ECS systems).
7. **Each frame.** Phaser calls the state's `update()`, which forwards
   to `MapWorld.update()` — runs input/AI/movement/collision/etc.,
   drains `gameplay.consumeActions()` for things like
   `player.respawn`, feeds ECS messages back into
   `gameplay.process()`.
8. **Escape pressed.** `boot.js`'s listener calls `returnToMenu()`:
   `game.state.start("Menu")` triggers the outgoing state's
   `shutdown()`, which calls `MapWorld.destroy()` — this snapshots each
   player's inventory back onto their persistent `User.state` and
   unbinds it, then tears down the raycaster/bindings. `Gameplay`,
   the `GameRules` instance, and the `User`s are untouched. Then
   `gameMenu.show()`.
9. **"Start Game" again.** Back to step 4/5 — a fresh
   `GameplaySession` is constructed and overwrites the old one in
   `ServiceLocator`. (If you instead want the *same* session to persist
   across a map change without rebuilding `Gameplay`/`Users`, that's
   the `MapWorld` A→B transition exercised in
   `tests/session-lifecycle.test.mjs` — a different path from
   returning to the menu.)

---

## Extending this (cookbook)

- **New map or entity dataset:** export it from the editor into
  `scripts/data/maps/<name>.json` or `scripts/data/entities/<name>.json`,
  run `npm run data:build` (or `npm start`). It appears in the menu's
  selects automatically — no code changes.
- **New game mode:** add a `GameRules` subclass, add a `case` in
  `createRulesForSession.js`'s switch, add it to that file's exported
  `GAME_MODES` list. If it needs its own Phaser state, register it in
  `boot.js` and add an entry to `STATE_BY_MODE`.
- **New rule field exposed in the menu:** only add it if the
  corresponding `GameRules` subclass actually reads it — don't
  resurrect dead config (e.g. `friendlyFire`/`ammo`/`health` on
  `sessions.js`'s example fixtures are never read by any system; the
  menu deliberately doesn't expose them).
- **New bot modifier:** only add it if `EntitySpawner`'s
  `applyModifiers()` actually implements it (today: `healthMultiplier`
  only).
- **New resource type:** add it to `scripts/system/resourceData.js`
  (mirrors `itemData.js`'s role for weapons). It appears as a loadout
  field on every player row in the menu automatically — no
  `GameMenu.js` changes.
- **A rule that spawns things at runtime (like `WaveRules`):** decide
  *where*/*when* inside the rule class itself — see
  `WaveRules.resolveSpawnZone()`, which reasons about `mapData.spawnZones`
  (handed to it via `attachWorld()`) rather than trusting a location
  baked into session config. Session config/the menu should describe
  composition only (what/how many); see "Where a decision belongs" below.

## Where a decision belongs

Four layers, four jobs — don't blur them:

- **Session configuration** (the menu, `sessions.js` fixtures) describes
  *how a game starts*: game mode, map, entity dataset, players/bots,
  and initial rule composition (e.g. `scoreLimit`, wave `prefab`/`count`).
  It never decides a *runtime* outcome (where the next wave spawns, which
  enemies are active, who respawns where).
- **`Gameplay`/`GameRules`** own runtime gameplay decisions. If a rule
  needs map-specific spatial data to make one (e.g. `WaveRules` picking a
  spawn zone), it reads generic map data itself via `attachWorld()`
  /`onMapLoaded()` — session config only ever supplies an optional
  override (`rules.defaultSpawnZone`, `wave.spawnZone`), never the
  decision itself.
- **Map data** describes the map/world, not game-mode-specific
  behaviour: cells, spawn points, and generically-named `spawnZones`
  (`courtyard`, `north`, ...). A map must never declare *which* zone is
  "the enemy zone" (no `enemySpawnZone`-shaped property) — the *meaning*
  of a zone name is for a `GameRules` subclass to interpret, not for the
  map to assert.
- **`EntityManager`/ECS** own runtime entities. Every spawn path
  (authored, player, bot, or rules-driven) is a live entity the instant
  `EntitySpawner`/`PrefabFactory` registers it there; nothing upstream
  (not `MapWorld`, not a rule) keeps a second id-keyed collection that
  would need manual synchronising as entities spawn/despawn/respawn.

Concretely, this is why `GameMenu.js` no longer emits a wave `spawnZone`
(that was a menu asserting a runtime decision) and why `WaveRules`
resolves its own spawn zone rather than requiring one in `rules.waves[]`.

## Boundaries to preserve

- The HTML menu (`scripts/ui/GameMenu.js`) must never import
  `Gameplay`, `GameplaySession`, `MapWorld`, `EntitySpawner`, or any ECS
  class — it only ever produces a `sessionConfig` object.
- A Phaser map state must never construct a `GameplaySession` — only
  resolve one via `ServiceLocator`.
- A Phaser map state must never reconstruct or reach into the HTML
  menu — menu visibility is the application layer's (`boot.js`) job.
- `MapWorld` owns nothing that should outlive a map transition; anything
  that should belongs on `GameplaySession` or `User.state` instead.
- `MapWorld` must not keep its own id-keyed entity collection —
  `entities`/`getEntity(id)` are read-only facades onto
  `this.entityManager`, the one authoritative runtime store (see "Where a
  decision belongs" above).
