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

export class Whiteroom {
  create() {
    let entities = [];
    BasicGame.entities = entities;
    this.movementSystem;
    this.inputSystem;
    this.overlapSystem;
    this.triggerSystem;
    this.trackerSystem;
    console.log("White level loaded");
    BasicGame.service = ServiceLocator;
    this.eventSystem = new EventBus();

    // All systems can reach the entity manager via Service locator
    let entityManager = new EntityManager();

    // Generate entities from Json
    const prefabFactory = new PrefabFactory(
      entityManager,
      componentDefaults,
      defaultLevel
    );
    entities = prefabFactory.loadLevel();

    // Create and assign systems
    this.movementSystem = new MotionSystemShip();
    this.inputSystem = new InputSystem(this.movementSystem);
    this.overlapSystem = new OverlapSystem(
      ["OverlapComponent"],
      ["PlayerComponent"]
    );
    this.triggerSystem = new TriggerSystem(
      ["TriggerComponent"],
      ["PlayerComponent"]
    );
    this.inputSystem.addSystemListener(this.triggerSystem);
    this.trackerSystem = new TrackerSystem();

    BasicGame.test = entities;
    BasicGame.SpriteComponent = SpriteComponent;
    // entities[0]
    //   .getComponent("WeaponControllerComponent")
    //   .switchWeapon(entities[3]);
    // entities[0]
    //   .getComponent("WeaponControllerComponent")
    //   .switchWeapon(entities[3]);
    entities[0].addComponent(
      new SpriteComponent(entities[0], { spriteKey: "defaultObject" })
    );
  }

  update() {
    this.triggerSystem.update();
    this.trackerSystem.update();
  }

  preRender() {}

  render() {
    // game.time.advancedTiming = true;
    // game.debug.text(game.time.fps, 20, 14, "#00ff00");
  }

  shutdown() {
    // BasicGame.AudioSystem.ResetAudio();
    // BasicGame.SuperSpriteGroup.destroy(true);
    // BasicGame.ResetGameSystems(BasicGame.objectGarbageArray);
    // BasicGame.GlobalSignals.reset_PM_SIGNALS.dispatch();
  }
}
