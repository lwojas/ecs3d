import { Projectile } from "./Projectile.js";
import { projectileData } from "./projectileData.js";

export class ProjectileSystem {
  constructor(raycaster, renderer, collisionSystem) {
    this.raycaster = raycaster;
    this.spriteRenderArray = renderer.sprites;
    this.lightRenderArray = renderer.lights;
    this.pools = {};
    this.collisionSystem = collisionSystem;
    // console.log(collisionSystem);
  }

  createProjectile(type) {
    const data = projectileData[type];

    if (!data) {
      throw new Error(`Unknown projectile type: ${type}`);
    }

    return new Projectile(type, data);
  }

  getProjectile(type) {
    let pool = this.pools[type];

    if (!pool) {
      pool = [];
      this.pools[type] = pool;
    }

    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].active) {
        return pool[i];
      }
    }

    const projectile = this.createProjectile(type);

    pool.push(projectile);
    this.collisionSystem.externalList.push(projectile);

    return projectile;
  }

  fire(type, x, y, z, vx, vy, vz, owner) {
    const data = projectileData[type];
    const projectile = this.getProjectile(type);
    projectile.setOwner(owner);
    projectile.fire(x, y, z, vx, vy, vz);

    return projectile;
  }

  fireAtTarget(type, x, y, z, targetX, targetY, targetZ, owner) {
    const data = projectileData[type];
    const projectile = this.getProjectile(type);
    projectile.setOwner(owner);
    projectile.fireAtTarget(x, y, z, targetX, targetY, targetZ, data.speed);

    return projectile;
  }

  update(delta) {
    const pools = this.pools;

    for (const type in pools) {
      const pool = pools[type];

      for (let i = 0; i < pool.length; i++) {
        const projectile = pool[i];

        if (!projectile.active) {
          continue;
        }

        projectile.age += delta;

        if (projectile.age >= projectile.lifetime) {
          projectile.active = false;
          continue;
        }

        const nextX = projectile.x + projectile.vx * delta;
        const nextY = projectile.y + projectile.vy * delta;
        const nextZ = projectile.z + projectile.vz * delta;

        if (this.raycaster.isWallWorld(nextX, nextY)) {
          projectile.active = false;
          continue;
        }

        projectile.x = nextX;
        projectile.y = nextY;
        projectile.z = nextZ;

        this.spriteRenderArray.push(projectile);
        if (projectile.isLightSource) {
          this.lightRenderArray.push(projectile);
        }
      }
    }
  }
}
