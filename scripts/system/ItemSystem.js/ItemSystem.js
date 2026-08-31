import { ServiceLocator } from "../../services/ServiceLocator.js";
import { resolveComponentList } from "../../tools/componentResolver.js";
import { checkResource } from "../ResourceSystem.js";
import { System } from "../System.js";
import { itemData } from "./itemData.js";

export class ItemSystem extends System {
  constructor(hud, projectileSystem) {
    super();
    this.projectileSystem = projectileSystem;
    this.hud = hud;
    this.itemData = itemData;
    this.reloadTime = 0;
  }

  resolveItem(itemName) {
    return this.itemData[itemName];
    // console.log(item);
  }

  useItem(itemName, userId, boundTarget, enemyTarget) {
    // console.log(boundTarget);
    const item = this.resolveItem(itemName);
    if (item.type === "weapon") {
      this.useWeapon(item, boundTarget, enemyTarget);
    }
    // if (targetId) console.log(targetId);
  }

  useWeapon(item, boundTarget, enemyTarget) {
    if (!item.melee) {
      this.fireWeapon(item, boundTarget, enemyTarget);
    } else {
      // Melee stuff
    }
  }

  fireWeapon(item, boundTarget, enemyTarget) {
    const { fireRate, fireMode, projectile } = item;
    const itemComponent = boundTarget.entity.getComponent("ItemComponent");
    const hasHud = boundTarget.entity.hasComponent("HudComponent");
    const now = game.time.now / 1000;

    if (now >= itemComponent.nextFireTime) {
      if (boundTarget.entity.hasComponent("ResourceComponent")) {
        const resourceName = item.projectile;
        const resources = checkResource(resourceName, boundTarget.entity);
        console.log(resources);
        if (!resources) return;
        resources[resourceName] -= item.consumes;
        if (hasHud) this.hud.setAmmo(resources[resourceName], 0);
      }
      let fireRateModifier = 0;
      if (enemyTarget) {
        this.fireToTarget(item, boundTarget, enemyTarget);
        fireRateModifier = 2; // Move this to component
      } else {
        this.fireFromCamera(item, boundTarget);
        // game.camera.shake();
        if (hasHud) this.hud.items.setState("fire");
      }
      itemComponent.nextFireTime = now + fireRate + fireRateModifier;
    }
  }

  fireFromCamera(item, boundTarget) {
    const distance = 2;
    const speed = 50;

    // boundTarget.viewAngle is the same raw value CameraRenderer assigns to
    // camera.pitch -- a screen-space horizon shift in pixels, not degrees
    // or radians (see raycaster-api.md). Converting it to an angle
    // ourselves here (via a fixed degrees/radians factor) used to be the
    // bug behind aim not matching the rendered view: the real equivalent
    // angle depends on the raycaster's focalLength, so getCameraForwardVector()
    // is the one place that conversion happens, guaranteeing this always
    // matches whatever the renderer is actually showing.
    const {
      x: directionX,
      y: directionY,
      z: directionZ,
    } = this.projectileSystem.raycaster.getCameraForwardVector({
      angle: boundTarget.angle,
      pitch: boundTarget.viewAngle,
    });

    const x = boundTarget.x + directionX * distance;
    const y = boundTarget.y + directionY * distance;
    const z = boundTarget.z - 2 + directionZ * distance;

    this.projectileSystem.fire(
      item.projectile,
      x,
      y,
      z,
      directionX * speed,
      directionY * speed,
      directionZ * speed,
      boundTarget,
    );
  }

  fireToTarget(item, boundTarget, enemyTarget) {
    const distance = 2;

    const dx = enemyTarget.x - boundTarget.x;
    const dy = enemyTarget.y - boundTarget.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    const x = boundTarget.x + (dx / length) * distance;
    const y = boundTarget.y + (dy / length) * distance;
    const z = boundTarget.z - 2;

    this.projectileSystem.fireAtTarget(
      item.projectile,
      x,
      y,
      z,
      enemyTarget.x,
      enemyTarget.y,
      enemyTarget.z - 2,
      boundTarget,
    );
  }
}
