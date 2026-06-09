import { System } from "./System.js";
import { TrackerComponent } from "../components/tags/TrackerComponent.js";
import { ServiceLocator } from "../services/ServiceLocator.js";
import { spriteLayers } from "./utils/spriteLayers.js";

export class WeaponSystem extends System {
  constructor() {
    super();
    this.entities = this.entityManager.registerSystem(this, [
      "WeaponComponent",
    ]);
    this.entities.forEach((entity) => {
      this.createWeapon(entity);
    });
    this.weaponTime = 0;

    this.weaponControllers = {};
    this.weaponControllers.entities = this.entityManager.registerSystem(this, [
      "WeaponControllerComponent",
    ]);
    ServiceLocator.resolve("game", "EventSystem").on(
      "G_EQUIP_WEAPON",
      this.equipWeapon,
    );

    ServiceLocator.resolve("game", "EventSystem").on(
      "G_SPRITE_UPDATED",
      this.refreshWeapon.bind(this),
    );

    ServiceLocator.resolve("game", "EventSystem").on(
      "G_USE_WEAPON",
      this.useWeapon.bind(this),
    );
  }

  refreshWeapon(entity) {
    // If we change the player sprite
    if (!entity.hasComponent("WeaponControllerComponent")) return;
    const currentWeapon = entity.getComponent(
      "WeaponControllerComponent",
    ).currentWeapon;
    if (currentWeapon) {
      console.log(this);
      this.equipWeapon(currentWeapon, entity);
    }
  }

  createWeapon(entity) {
    let weaponComponent = entity.getComponent("WeaponComponent");
    weaponComponent.weaponSprite = game.add.sprite(
      100,
      100,
      weaponComponent.spriteKey,
    );
    spriteLayers.fg4.add(weaponComponent.weaponSprite);
    // console.log("Weapon sprite created");
    weaponComponent.weaponSprite.anchor.setTo(0.5, 0.5);
    weaponComponent.weaponSprite.scale.setTo(2, 2);
    weaponComponent.weaponSprite.kill();
  }

  equipWeapon(weaponEntity, entity) {
    if (!entity.hasComponent("WeaponControllerComponent")) return;
    let weaponController = entity.getComponent("WeaponControllerComponent");
    const inventory = entity.getComponent("InventoryComponent").inventory;
    if (inventory.has(weaponEntity)) {
      if (weaponController.currentWeapon) {
        weaponController.currentWeapon
          .getComponent("WeaponComponent")
          .weaponSprite.kill();
        weaponController.currentWeapon.removeComponent("TrackerComponent");
        weaponController.currentWeapon = null;
      }
      weaponController.currentWeapon = weaponEntity;
      //   console.log(entity, this.entity);

      weaponEntity.getComponent("WeaponComponent").weaponSprite.reset(0, 0);
      weaponEntity.addComponent(
        new TrackerComponent(
          weaponEntity,
          weaponEntity.getComponent("WeaponComponent").weaponSprite,
          entity.getComponent("SpriteComponent").sprite,
        ),
      );
    }
  }

  receiveInteraction(entities, keyCode) {
    // console.log(keyCode);
    entities.forEach((entity) => {
      this.useWeapon(entity);
    });
  }

  useWeapon(entity) {
    if (!entity.hasComponent("WeaponControllerComponent")) return;
    let currentWeapon = entity.getComponent(
      "WeaponControllerComponent",
    ).currentWeapon;
    if (!currentWeapon) return;
    const weaponComponent = currentWeapon.getComponent("WeaponComponent");

    if (game.time.now < this.weaponTime) return;
    this.weaponTime = game.time.now + weaponComponent.fireRate;

    let weaponClass = weaponComponent.weaponClass;
    // console.log(currentWeapon.getComponent("WeaponComponent"));
    if (weaponClass === "gun")
      this.fireGun(entity, currentWeapon, weaponComponent);
  }

  fireGun(entity, currentWeapon, weaponComponent) {
    if (!entity.hasComponent("AmmoComponent")) return;
    let ammoInventory = entity.getComponent("AmmoComponent").ammoInventory;
    let weaponType = weaponComponent.weaponType;
    let ammoAmount = ammoInventory.get(weaponType);
    console.log(ammoAmount);
    // console.log(currentWeapon);
    if (currentWeapon && ammoAmount) {
      ammoAmount--;
      // A bit heavy
      ammoInventory.set(weaponType, ammoAmount);
      this.sendInteraction([currentWeapon, entity]);
    }
  }

  update() {
    this.weaponControllers.entities.forEach((entity, index) => {
      let weapon = entity.getComponent(
        "WeaponControllerComponent",
      ).currentWeapon;
      if (weapon) {
        const sprite = weapon.getComponent("WeaponComponent").weaponSprite;
        if (entity.hasComponent("PlayerComponent")) {
          sprite.rotation = game.physics.arcade.angleToPointer(
            sprite,
            game.input.activePointer,
            true,
          );
        } else {
          const spriteComp = entity.getComponent("SpriteComponent");
          sprite.rotation = spriteComp.sprite.rotation;
        }
      }
    });
  }
}
