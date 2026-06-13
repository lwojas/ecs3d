import { InputSystem } from "./system/InputSystem.js";
import { ServiceLocator } from "./services/ServiceLocator.js";
import { EntityManager } from "./services/EntityManager.js";
import { OverlapSystem } from "./system/OverlapSystem.js";
import { PrefabFactory } from "./services/PrefabFactory.js";
import { componentDefaults } from "./data/SharedData.js";
import { defaultLevel } from "./data/DefaultLevel.js";
import { TriggerSystem } from "./system/TriggerSystem.js";
import { MotionSystemShip } from "./system/MotionSystemShip.js";
import { TrackerSystem } from "./system/TrackerSystem.js";
import { SpriteComponent } from "./components/SpriteComponent.js";
import { EventBus } from "./services/EventBus.js";
import { WeaponSystem } from "./system/WeaponSystem.js";
import { CameraSystem } from "./system/CameraSystem.js";
import { InventorySystem } from "./system/InventorySystem.js";
import { ProjectileSystem } from "./system/ProjectileSystem.js";
import { AmmoSystem } from "./system/AmmoSystem.js";
import { registerEvents } from "./services/Events.js";
import { initialiseSpriteLayers } from "./system/utils/spriteLayers.js";
import { LightSystem } from "./system/LightSystem.js";
import { PerceptionSystem } from "./system/PerceptionSystem.js";
import { AIScoringSystem } from "./system/AIScoringSystem.js";
import { CollideSystem } from "./system/CollideSystem.js";
import { NPCMotionSystem } from "./system/NPCMotionSystem.js";
import { DebugSystem } from "./system/DebugSystem.js";
import { PendulumSystem } from "./system/PendulumSystem.js";
import { TapInputSystem } from "./system/TapInputSystem.js";
import { pendulumLevel } from "./data/pendulumLevel.js";
import { KillSystem } from "./system/KillSystem.js";
import { GoalSystem } from "./system/GoalSystem.js";
import { createExplosion } from "./system/utils/explosionShip.js";
import { ExplosionSystem } from "./system/ExplosionSystem.js";

export class Whiteroom {
  create() {
    this.entities = [];
    initialiseSpriteLayers();
    BasicGame.entities = this.entities;
    this.movementSystem;
    this.inputSystem;
    this.overlapSystem;
    this.triggerSystem;
    this.trackerSystem;
    console.log("White level loaded");
    BasicGame.service = ServiceLocator;

    this.debugSystem = new DebugSystem();

    // Automatically registers to ServiceLocator - needs domain ("system", "game")
    this.eventSystemGame = new EventBus("game");

    // All systems can reach the entity manager via Service locator
    this.entityManager = new EntityManager();

    // Generate entities from Json
    const prefabFactory = new PrefabFactory(
      this.entityManager,
      componentDefaults,
      defaultLevel,
      // pendulumLevel,
    );
    this.entities = prefabFactory.loadLevel();

    // Create and assign systems

    // this.overlapSystem = new OverlapSystem(
    //   ["OverlapComponent"],
    //   ["PlayerComponent"]
    // );

    // Tidy up
    this.movementSystem = new MotionSystemShip();
    this.inputSystem = new InputSystem(this.movementSystem);
    this.triggerSystem = new TriggerSystem(
      ["TriggerComponent"],
      ["TriggerSendComponent"],
    );
    this.inputSystem.addSystemListener(this.triggerSystem);

    this.inventorySystem = new InventorySystem();
    this.cameraSystem = new CameraSystem(this.entities);
    this.weaponSystem = new WeaponSystem();
    this.tapInputSystem = new TapInputSystem();
    this.inputSystem.addSystemListener(this.weaponSystem);
    this.pendulumSystem = new PendulumSystem();

    this.projectileSystem = new ProjectileSystem(this.entities);
    this.weaponSystem.addSystemListener(this.projectileSystem);
    this.ammoSystem = new AmmoSystem(this.entities);

    this.trackerSystem = new TrackerSystem();
    this.perceptionSystem = new PerceptionSystem();
    this.AIscoringSystem = new AIScoringSystem();

    this.collisionSystem = new CollideSystem();
    this.goalSystem = new GoalSystem(this.entities);
    this.killSystem = new KillSystem();
    this.explosionSystem = new ExplosionSystem();
    // Testing only
    BasicGame.entities = this.entities;
    BasicGame.SpriteComponent = SpriteComponent;
    // this.inventorySystem.addItem(this.entities[3], this.entities[0]);
    // this.weaponSystem.equipWeapon(this.entities[3], this.entities[0]);

    // entities[0].addComponent(
    //   new SpriteComponent(entities[0], { spriteKey: "defaultObject" })
    // );

    this.lightSystem = new LightSystem();
    // createExplosion();

    registerEvents();
  }

  update() {
    const delta = game.time.now;
    this.debugSystem.update();
    this.inputSystem.update();
    this.movementSystem.update();
    this.pendulumSystem.update();
    this.triggerSystem.update();
    this.trackerSystem.update();
    this.weaponSystem.update();
    this.perceptionSystem.update(delta);
    this.AIscoringSystem.update();
    // this.NPCMovementSystem.update();
    this.projectileSystem.update();
    this.killSystem.update();
    this.lightSystem.update(delta);
    this.explosionSystem.update();
    this.collisionSystem.update();
  }

  preRender() {}

  render() {
    // game.time.advancedTiming = true;
    // game.debug.text(game.time.fps, 20, 14, "#00ff00");
  }

  shutdown() {
    this.inventorySystem.shutdown(this.entities);
    ServiceLocator.shutDown();
  }
}
