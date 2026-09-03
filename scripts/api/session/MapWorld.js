import { Raycaster } from "../../system/Raycaster.js";
import componentDefaults from "../../data/templates/componentDefaults.js";
import { EntityManager } from "../../services/EntityManager.js";
import { PrefabFactory } from "../../services/PrefabFactory.js";
import { EntitySpawner } from "../../services/EntitySpawner.js";
import { EventBus } from "../../services/EventBus.js";
import { MovementSystem } from "../../system/MovementSystem.js";
import { InputController } from "../../system/InputController.js";
import {
  setAllBindings,
  clearAllBindings,
  registerUser,
} from "../../tools/runtimeBindings.js";
import { CameraRenderer } from "../../system/CameraRenderer.js";
import { SpriteSystem } from "../../system/SpriteSystem.js";
import HUD from "../../hud/hud.js";
import { hudItems } from "../../hud/hudData.js";
import { ProjectileSystem } from "../../system/Projectile/ProjectileSystem.js";
import { CollisionSystem } from "../../system/CollisionSystem.js";
import { InventorySystem } from "../../system/InventorySystem.js";
import { LightSystem } from "../../system/LightSystem.js";
import { ECSBridge } from "../../system/ECSBridge.js";
import { EventRouter } from "../../services/EventRouter.js";
import { InteractionSystem } from "../../system/InteractionSystem.js";
import { ItemSystem } from "../../system/ItemSystem.js/ItemSystem.js";
import { AISystem } from "../../system/AISystem.js";
import { CombatSystem } from "../../system/CombatSystem.js";
import { TriggerSystem } from "../../system/TriggerSystem.js";
import {
  resolveMapData,
  resolveEntityData,
  resolveSessionPlayers,
} from "./sessions.js";
import { componentClasses } from "../../services/ComponentClasses.js";
import { TransformSystem } from "../../system/TransformSystem.js";

function createDefaultRaycaster(game, mapData) {
  const raycaster = new Raycaster(game, mapData, {
    width: 320,
    height: 180,
    debugSpriteAnchors: true,
    cellSize: 4,
    wallHeight: 8,
    cameraHeight: 4,
    fov: Math.PI / 3,
    maxDistance: 1000,
    renderer: "wasm",
  });
  raycaster.resizeToCamera();
  return raycaster;
}

// The current map/world -- everything that only lives as long as the
// map does. A Phaser state hosts this -- forward init/create/update/
// shutdown -- never a GameplaySession itself; see GameplaySession.js
// for the persistent gameplay/rules/users that survive across
// MapWorld instances.
//
//   GameplaySession -> MapWorld -> map + entity data
//                                  + EntityManager/EntitySpawner
//                                  + player ECS entities (hydrated from
//                                    the persistent Users GameplaySession
//                                    already owns)
//                                  + ECS systems
//
// Split into buildWorld() (no Phaser/DOM dependency beyond an injectable
// raycaster factory) and attachView() (HUD/camera/input -- Phaser-only),
// so the world-construction/spawning logic is unit-testable without a
// browser; see tests/game-session.test.mjs and
// tests/session-lifecycle.test.mjs.
export class MapWorld {
  constructor(
    gameplaySession,
    { game, createRaycaster = createDefaultRaycaster } = {},
  ) {
    this.gameplaySession = gameplaySession;
    this.config = gameplaySession.config;
    this.gameplayManager = gameplaySession.gameplay;
    this.rules = gameplaySession.rules;
    this.game = game;
    this.createRaycaster = createRaycaster;
  }

  buildWorld() {
    const session = this.config;
    const mapData = resolveMapData(session.map);
    const entityData = session.entities
      ? resolveEntityData(session.entities)
      : [];

    this.eventSystemGame = new EventBus("game");
    this.eventRouter = new EventRouter(this.eventSystemGame);
    this.entityManager = new EntityManager();
    this.inventorySystem = new InventorySystem();

    const prefabFactory = new PrefabFactory(
      this.entityManager,
      componentDefaults,
    );

    this.raycaster = this.createRaycaster(this.game, mapData);

    this.spawner = new EntitySpawner({
      prefabFactory,
      raycaster: this.raycaster,
      mapData,
    });

    // Case A/B: whatever authored entities the session's entity data
    // references -- each carries its own SpawnComponent. Every entity
    // this spawns (or anything else spawns below) is already registered
    // with this.entityManager by EntitySpawner/PrefabFactory -- see the
    // entities/getEntity() facade at the bottom of this class, which
    // reads through to it rather than keeping a second, separately
    // maintained collection here.
    this.spawner.spawnAuthored(entityData);

    // Players: a bot is a player controlled by AI, not a separate enemy
    // population -- resolveSessionPlayers() folds session.botCount into
    // ordinary player entries, so this is the one loop that decides "how
    // does a player get an entity," for humans and bots alike. Reuses an
    // authored entity matching this player's id if the entity data
    // already provides one (Case A/B); otherwise spawns one dynamically
    // (Case C, any coop player beyond the authored one, and every bot).
    const players = resolveSessionPlayers(session);
    this.sessionPlayers = players; // attachView() needs controller too

    this.playerEntities = new Map();
    players.forEach((sessionPlayer) => {
      const isBot = sessionPlayer.controller === "bot";
      // The persistent User for this player -- owned by GameplaySession's
      // Gameplay, not this world. Bots get one too (so gameplay.players
      // stays the single roster), it just has no meaningful `state`.
      const user = this.gameplayManager.getPlayer(sessionPlayer.id);
      let entity = this.getEntity(sessionPlayer.id);

      if (!entity) {
        // team and controller are orthogonal overrides -- a human can
        // have a team, a bot doesn't need one, and having a team never
        // implies AI control or vice versa.
        const components = {};
        if (sessionPlayer.team) {
          components.ActorComponent = { team: sessionPlayer.team };
        }
        if (isBot) {
          // Reuses AISystem/AIComponent exactly as any NPC does -- being
          // a "player" entity changes nothing about how AISystem
          // perceives or drives it.
          components.AIComponent = { disposition: "enemy" };
        }

        // Modifier precedence: session-wide modifiers apply to every
        // player; this player's own override layers on top; bot-only
        // modifiers apply last, and only for bots -- a human never sees
        // session.botModifiers. Each stage overrides the same key in the
        // last (not cumulative/multiplied), consistent with every other
        // default->override merge in this codebase. These are
        // scenario/session-level config, not persistent player state --
        // they stay sourced from the session, not the persistent User.
        const modifiers = {
          ...session.modifiers,
          ...sessionPlayer.modifiers,
          ...(isBot ? session.botModifiers : null),
        };

        entity = this.spawner.spawn({
          prefab: "player",
          uniqueId: sessionPlayer.id,
          spawnZone: isBot
            ? (session.botSpawnZone ?? "courtyard")
            : (session.playerSpawnZone ?? "players"),
          components,
          modifiers,
        });
      }

      // Initial InventoryComponent precedence: an authored/scenario
      // override on this entity's own data always wins (a scripted
      // mission loadout beats whatever the player was carrying);
      // otherwise the persistent User's inventory carries forward;
      // component defaults (already applied during construction above)
      // are the last resort. A bot's User has no meaningful `state` (the
      // common case) and simply has nothing to apply here, keeping the
      // component defaults -- it never needs a human-shaped User.state.
      // Loaded via InventorySystem so this goes through the same
      // add/equip operations any other caller would use.
      const authoredInventory = entityData.find(
        (data) => data.uniqueId === sessionPlayer.id,
      )?.components?.InventoryComponent;

      const persistentInventory = user?.state?.inventory;
      if (!authoredInventory && persistentInventory) {
        const inventory = this.inventorySystem.getInventory(entity);
        if (inventory) {
          inventory.items = [];
          (persistentInventory.items ?? []).forEach((itemId) =>
            this.inventorySystem.add(entity, itemId),
          );
          if (persistentInventory.equipped) {
            this.inventorySystem.equip(entity, persistentInventory.equipped);
          }
        }
      }

      const authoredResources = entityData.find(
        (data) => data.uniqueId === sessionPlayer.id,
      )?.components?.ResourceComponent;

      const persistentResources = user?.state?.resources;
      if (!authoredResources && persistentResources) {
        const resources = { ...persistentResources };
        entity.addComponent(
          new componentClasses["ResourceComponent"](entity, resources),
          resources,
        );
      }

      user?.bindEntity(entity.id);
      this.playerEntities.set(sessionPlayer.id, entity);
    });

    // Rules persist across maps; the spawner (and this world's other
    // context) doesn't -- hand it over now, MapWorld.destroy() takes it
    // back before this world goes away.
    this.rules.attachWorld?.({
      spawner: this.spawner,
      entityManager: this.entityManager,
      mapData,
    });

    this.gameplayManager.loadMap(session.map); // e.g. WaveRules spawns its waves here -- fires on every map load.
    this.gameplayManager.start(); // one-time per session; no-ops after the first map (state leaves IDLE).
  }

  attachView() {
    this.ecs = new ECSBridge();

    this.hud = new HUD(this.game);
    this.hud.items.registerAll(hudItems);
    this.inventorySystem.registerHud(this.hud);

    this.gameplayManager.players.forEach((user) => {
      // Bots have no local camera/input to bind -- without this, the
      // last bot processed here would silently steal this.cameraRenderer/
      // this.inputController from whichever human player set it first.
      const sessionPlayer = this.sessionPlayers.find(
        (player) => player.id === user.id,
      );
      if (sessionPlayer?.controller === "bot") return;

      registerUser(user.id);
      const playerMovement = this.playerEntities
        .get(user.id)
        ?.getComponent("MovementComponent");
      this.cameraRenderer = new CameraRenderer(this.raycaster, user.id);
      this.interactionSystem = new InteractionSystem(
        this.hud,
        this.gameplayManager,
      );
      this.inputController = new InputController(
        user.id,
        this.interactionSystem,
      );
      // Syncs the HUD viewmodel/ammo display to whatever InventoryComponent
      // already resolved as equipped during buildWorld() -- this is a
      // display sync, not a gameplay decision (InventorySystem.equip()
      // is idempotent here, re-equipping the same item).
      const player = this.playerEntities.get(user.id);
      this.inventorySystem.syncHud(player);
      // this.hud.items.equip("pistol");

      if (playerMovement) setAllBindings(user.id, playerMovement);
    });

    this.movementSystem = new MovementSystem(this.raycaster);
    this.spriteSystem = new SpriteSystem(this.cameraRenderer);
    this.collisionSystem = new CollisionSystem(this.cameraRenderer);
    this.projectileSystem = new ProjectileSystem(
      this.raycaster,
      this.cameraRenderer,
      this.collisionSystem,
    );
    this.combatSystem = new CombatSystem(
      this.ecs,
      this.collisionSystem.collisionEvents,
    );
    this.lightSystem = new LightSystem(this.cameraRenderer);
    this.triggerSystem = new TriggerSystem(
      this.collisionSystem.collisionEvents,
    );
    this.itemSystem = new ItemSystem(this.hud, this.projectileSystem);
    this.interactionSystem.setItemSystem(this.itemSystem);
    this.aiSystem = new AISystem(this.raycaster, this.itemSystem);
    this.transformSystem = new TransformSystem();

    this.eventRouter.registerLightingSystem(this.lightSystem);
    this.eventRouter.registerHud(this.hud);
    this.eventRouter.registerInventory(this.inventorySystem);

    this.hud.bringToTop();
    this.hud.notify("Welcome to hell!");
  }

  start() {
    this.buildWorld();
    this.attachView();
  }

  update() {
    const delta = this.game.time.elapsed / 1000;
    const ecs = this.ecs;

    this.inputController.update(delta, ecs);
    this.aiSystem.update(delta, ecs);
    this.movementSystem.update(delta, ecs);
    this.collisionSystem.update();
    this.triggerSystem.update();
    this.spriteSystem.update();
    this.projectileSystem.update(delta);
    this.combatSystem.update(ecs);
    this.transformSystem.update(delta);
    this.lightSystem.update();
    this.cameraRenderer.update();

    const messages = this.ecs.consumeMessages();
    this.gameplayManager.process(messages);

    // The respawn seam: rules decide *whether* (SinglePlayerRules.
    // onEntityDamaged), this drains that decision and asks EntitySpawner
    // to actually do it, via the same actions queue Gameplay already
    // exposes.
    for (const action of this.gameplayManager.consumeActions()) {
      if (action.type !== "player.respawn") continue;
      const entity = this.getEntity(action.playerId);
      if (entity) this.spawner.respawn(entity);
    }

    this.hud.setItemLighting(this.cameraRenderer.viewmodelLight);
  }

  // Only tears down this map's world -- GameplaySession's Gameplay,
  // Rules and Users are untouched and outlive this instance.
  destroy() {
    this.rules.detachWorld?.();

    // Snapshot whatever's snapshot-able back onto each persistent User
    // before their entity goes away, and unbind -- the seam a future
    // map-transition/checkpoint rule can build on for the rest of
    // User.state (health, resources, ...).
    for (const sessionPlayer of this.sessionPlayers ?? []) {
      const user = this.gameplayManager.getPlayer(sessionPlayer.id);
      const entity = this.playerEntities?.get(sessionPlayer.id);
      if (!user || !entity) continue;

      const inventorySnapshot = this.inventorySystem.getSnapshot(entity);
      if (inventorySnapshot) user.setState({ inventory: inventorySnapshot });
      user.unbindEntity();
    }

    if (this.raycaster) {
      this.raycaster.destroy();
      this.raycaster = null;
    }
    clearAllBindings();
  }

  // A read-only facade onto this.entityManager, not a second runtime
  // store -- EntityManager is the one authoritative collection of live
  // ECS entities (authored, player, bot, or dynamically spawned by a
  // GameRules subclass; all of them pass through the same
  // EntitySpawner/PrefabFactory -> EntityManager.addEntity() path), so
  // there's nothing here to keep manually synchronised.
  get entities() {
    return this.entityManager.world;
  }

  getEntity(id) {
    return this.entityManager.getEntity(id);
  }
}
