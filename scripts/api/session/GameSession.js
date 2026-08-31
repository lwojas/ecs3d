import { Raycaster } from "../../system/Raycaster.js";
import { componentDefaults } from "../../data/SharedData.js";
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
import { Gameplay } from "../rules/Gameplay.js";
import { User } from "../rules/User.js";
import { createRulesForSession } from "./createRulesForSession.js";
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
  });
  raycaster.resizeToCamera();
  return raycaster;
}

// The single orchestration point that turns a plain session config into
// a playable game. A Phaser state's job is only to host this -- forward
// init/create/update/shutdown -- never to decide what exists, where, or
// how many (see sessions.js for the session data contract).
//
//   Session config -> GameSession -> Map + entity data + Rules/Gameplay
//                                     + players + bots (all via the
//                                     existing EntitySpawner/PrefabFactory)
//                                     + ECS systems
//
// Split into buildWorld() (no Phaser/DOM dependency beyond an injectable
// raycaster factory) and attachView() (HUD/camera/input -- Phaser-only),
// so the world-construction/spawning logic is unit-testable without a
// browser; see tests/game-session.test.mjs.
export class GameSession {
  constructor(
    sessionConfig,
    { game, createRaycaster = createDefaultRaycaster } = {},
  ) {
    this.config = sessionConfig;
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
    // references -- each carries its own SpawnComponent.
    this.entities = this.spawner.spawnAuthored(entityData);
    this.entityById = new Map(
      this.entities.map((entity) => [entity.id, entity]),
    );

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
      let entity = this.entityById.get(sessionPlayer.id);

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
        // stat/config modifiers only (they land on component fields via
        // EntitySpawner's applyModifiers, e.g. healthMultiplier ->
        // HealthComponent.maximum) -- AI-behaviour tuning (accuracy,
        // reaction time, ...) is a different domain and doesn't belong
        // in this merge; it would be its own AIComponent field override
        // instead, the same way `components.AIComponent` above is set.
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
        this.entities.push(entity);
        this.entityById.set(entity.id, entity);
      }

      // Initial InventoryComponent precedence: an authored/scenario
      // override on this entity's own data always wins (a scripted
      // mission loadout beats whatever the player was carrying);
      // otherwise the player's persistent inventory carries forward;
      // component defaults (already applied during construction above)
      // are the last resort. A bot with no `state` (the common case)
      // simply has nothing to apply here and keeps the component
      // defaults -- it never needs a human-shaped User.state. Loaded via
      // InventorySystem so this goes through the same add/equip
      // operations any other caller would use.
      const authoredInventory = entityData.find(
        (data) => data.uniqueId === sessionPlayer.id,
      )?.components?.InventoryComponent;

      if (!authoredInventory && sessionPlayer.state?.inventory) {
        const persistentInventory = sessionPlayer.state.inventory;
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

      if (!authoredResources && sessionPlayer.state?.resources) {
        const resources = { ...sessionPlayer.state.resources };
        entity.addComponent(
          new componentClasses["ResourceComponent"](entity, resources),
          resources,
        );
      }

      this.playerEntities.set(sessionPlayer.id, entity);
    });

    const rules = createRulesForSession(session, { spawner: this.spawner });
    this.gameplayManager = new Gameplay({ rules });
    players.forEach((sessionPlayer) => {
      this.gameplayManager.addPlayer(new User(sessionPlayer));
    });
    this.gameplayManager.loadMap(session.map);
    this.gameplayManager.start(); // e.g. WaveRules spawns its waves here.
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

    this.movementSystem = new MovementSystem(this.raycaster, this.entities);
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
      const entity = this.entityById.get(action.playerId);
      if (entity) this.spawner.respawn(entity);
    }

    this.hud.setItemLighting(this.cameraRenderer.viewmodelLight);
  }

  destroy() {
    if (this.raycaster) {
      this.raycaster.destroy();
      this.raycaster = null;
    }
    this.gameplayManager = null;
    clearAllBindings();
  }
}
