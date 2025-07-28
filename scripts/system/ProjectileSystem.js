import { System } from "./System.js";

export class ProjectileSystem extends System {
  constructor(entities) {
    super();
    this.projectileCache = new Map();
    entities.forEach((entity) => {
      this.addProjectile(entity);
    });
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
    this.projectileCache.set(projectileComponent.weaponType, spriteGroup);
  }

  receiveInteraction(duds, entity) {
    // console.log(entities);
    this.fireProjectile(entity);
    // entities.forEach((entity) => {
    //   this.fireProjectile(entity);
    // });
  }

  fireProjectile(entity) {
    // console.log(entity);
    let weaponComponent = entity.getComponent("WeaponComponent");

    if (this.projectileCache.has(weaponComponent.weaponType)) {
      let projectileGroup = this.projectileCache.get(
        weaponComponent.weaponType
      );
      let projectile = projectileGroup.getFirstExists(false);
      if (projectile) {
        console.log("--Firing projectile");
        projectile.reset(
          weaponComponent.weaponSprite.world.x,
          weaponComponent.weaponSprite.world.y
        );
        projectile.rotation = game.physics.arcade.moveToPointer(
          projectile,
          1000,
          game.input.activePointer
        );
      }
    }
  }
}
