import { ServiceLocator } from "../services/ServiceLocator.js";
import { System } from "./System.js";
import { damageEntity } from "./utils/damageEntity.js";

export class ProjectileSystem extends System {
  constructor(entities) {
    super();
    this.projectileArray = [];
    this.projectileCache = new Map();
    entities.forEach((entity) => {
      this.addProjectile(entity);
    });
    this.entities = this.entityManager.registerSystem(this, [
      "HealthComponent",
    ]);
    console.log(this.projectileArray);
  }

  addProjectile(entity) {
    if (!entity.hasComponent("ProjectileComponent")) return;
    let projectileComponent = entity.getComponent("ProjectileComponent");
    let spriteGroup = game.add.group();

    spriteGroup.enableBody = true;
    spriteGroup.physicsBodyType = Phaser.Physics.ARCADE;
    spriteGroup.createMultiple(10, projectileComponent.spriteKey);
    spriteGroup.setAll("alpha", 1);
    spriteGroup.setAll("anchor.x", 1);
    spriteGroup.setAll("anchor.y", 0.5);
    spriteGroup.setAll("scale.x", 8);
    spriteGroup.setAll("scale.y", 8);
    spriteGroup.setAll("outOfCameraBoundsKill", true);
    spriteGroup.setAll("outOfBoundsKill", true);
    spriteGroup.setAll("checkWorldBounds", true);
    spriteGroup.setAll("parentEntity", entity, false, false, 0, true);
    this.projectileCache.set(projectileComponent.weaponType, spriteGroup);
    this.projectileArray.push(spriteGroup);
  }

  receiveInteraction(duds, [entity, parentEntity]) {
    // console.log(parentEntity);
    this.fireProjectile(entity, parentEntity);
    // entities.forEach((entity) => {
    //   this.fireProjectile(entity);
    // });
  }

  fireProjectile(entity, parentEntity) {
    // console.log(entity);
    let weaponComponent = entity.getComponent("WeaponComponent");

    if (this.projectileCache.has(weaponComponent.weaponType)) {
      let projectileGroup = this.projectileCache.get(
        weaponComponent.weaponType,
      );
      let projectile = projectileGroup.getFirstExists(false);
      if (projectile) {
        console.log("--Firing projectile");
        projectile.reset(
          weaponComponent.weaponSprite.world.x,
          weaponComponent.weaponSprite.world.y,
        );
        if (entity.hasComponent("PlayerComponent")) {
          projectile.rotation = game.physics.arcade.moveToPointer(
            projectile,
            1000,
            game.input.activePointer,
          );
        } else {
          game.physics.arcade.velocityFromRotation(
            parentEntity.getComponent("SpriteComponent").sprite.rotation,
            2000,
            projectile.body.velocity,
          );
        }
        // console.log(parentEntity);
        // projectile.rotation =
        //   parentEntity.getComponent("SpriteComponent").sprite.rotation;
        // projectile.velocity = 1000;
      }
    }
  }

  projectileImpact(actor, projectile) {
    console.log(actor, " has been hit");
    damageEntity(actor, projectile);
    projectile.kill();
    // actor.kill();
    // actor.parentEntity.isEnabled = false;

    // ServiceLocator.resolve("game", "EventSystem").emit(
    //   "G_REFRESH_ENTITY_LISTS",
    // );
  }

  update() {
    this.collide = game.physics.arcade.collide(
      this.projectileArray,
      this.actors,
      this.projectileImpact,
      null,
      this,
    );
  }
}
