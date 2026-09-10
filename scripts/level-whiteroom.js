import { Raycaster } from "./system/Raycaster.js";
import { testLevel } from "./data/3dtestLevel.js";
import componentDefaults from "./data/templates/componentDefaults.js";
import { EntityManager } from "./services/EntityManager.js";
import { PrefabFactory } from "./services/PrefabFactory.js";
import { EventBus } from "./services/EventBus.js";
import { MovementSystem } from "./system/MovementSystem.js";
import { InputController } from "./system/InputController.js";
import { resolveComponent } from "./tools/componentResolver.js";
import {
  runtimeBindings,
  setAllBindings,
  clearAllBindings,
  registerUser,
  getBindings,
} from "./tools/runtimeBindings.js";
import { CameraRenderer } from "./system/CameraRenderer.js";
import { SpriteSystem } from "./system/SpriteSystem.js";
import HUD from "./hud/hud.js";
import { hudItems } from "./hud/hudData.js";
import { ProjectileSystem } from "./system/Projectile/ProjectileSystem.js";
import { CollisionSystem } from "./system/CollisionSystem.js";
import { LightSystem } from "./system/LightSystem.js";
// import { GameplaySystem } from "./system/GameplaySystem.js";
import { ServiceLocator } from "./services/ServiceLocator.js";
import { ECSBridge } from "./system/ECSBridge.js";
import { InteractionSystem } from "./system/InteractionSystem.js";
import { ItemSystem } from "./system/ItemSystem/ItemSystem.js";
import { AISystem } from "./system/AISystem.js";
import { CombatSystem } from "./system/CombatSystem.js";

export class Whiteroom {
  preload() {}

  create() {
    this.gameplayManager = ServiceLocator.resolve("system", "GameplayManager");
    this.eventSystemGame = new EventBus("game");
    this.entityManager = new EntityManager();

    // Generate entities from Json
    const prefabFactory = new PrefabFactory(
      this.entityManager,
      componentDefaults,
    );
    this.entities = testLevel.entities.map((entityData) =>
      prefabFactory.createEntity(entityData),
    );

    // Initialise the raycaster
    this.raycaster = new Raycaster(this.game, testLevel, {
      width: 320,
      height: 180,
      debugSpriteAnchors: true,
      cellSize: 4,
      wallHeight: 8,
      cameraHeight: 4,
      fov: Math.PI / 3,
      maxDistance: 1000,
    });

    // For non-splite screen play
    this.raycaster.resizeToCamera();

    // Needs a home - this can be dynamic, time of day, fast switching, all possible
    this.ambient = 0.35;

    // Testing
    this.hud = new HUD(game);
    this.hud.items.registerAll(hudItems);
    this.hud.items.equip("pistol");

    // For testing
    this.player = resolveComponent("MovementComponent", this.entities[0]);

    // Gameplay manager is persistent through Phaser states
    // Example of allowing 1 or more local player instances
    // Obviously nonsense here as player 2 would override.

    this.ecs = new ECSBridge();

    this.gameplayManager.players.forEach((user) => {
      console.log(user.id);
      registerUser(user.id);
      this.cameraRenderer = new CameraRenderer(this.raycaster, user.id);
      this.interactionSystem = new InteractionSystem(
        this.hud,
        this.gameplayManager,
      );
      this.inputController = new InputController(
        user.id,
        this.interactionSystem,
      );
      setAllBindings(user.id, this.player);
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
    this.itemSystem = new ItemSystem(this.hud, this.projectileSystem);
    this.interactionSystem.setItemSystem(this.itemSystem);
    this.aiSystem = new AISystem(this.raycaster, this.itemSystem);

    // Place hud above everything else in z order
    this.hud.bringToTop();

    // Test hud notification
    this.hud.notify("Welcome to hell!");
  }

  update() {
    // Current frame time
    const delta = this.game.time.elapsed / 1000;

    const ecs = this.ecs;
    this.inputController.update(delta, ecs);
    this.aiSystem.update(delta, ecs);
    this.movementSystem.update(delta, ecs);
    this.collisionSystem.update();
    this.spriteSystem.update();
    this.projectileSystem.update(delta);
    this.combatSystem.update(ecs);
    this.lightSystem.update();
    this.cameraRenderer.update();

    // Example of just the gameplay manager consuming messages
    const messages = this.ecs.consumeMessages();
    this.gameplayManager.process(messages);

    this.hud.setItemLighting(this.cameraRenderer.viewmodelLight);
  }

  shutdown() {
    if (this.raycaster) {
      this.raycaster.destroy();
      this.gameplayManager = null;
      this.raycaster = null;
      clearAllBindings();
    }
  }
}
