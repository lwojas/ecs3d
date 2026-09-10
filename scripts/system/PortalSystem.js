import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class PortalSystem extends System {
  constructor(renderer, particles) {
    super();
    this.particles = particles;
    this.renderer = renderer;
    this.entities = this.entityManager.registerSystem(this, [
      "PortalComponent",
    ]);
    this.teleportHash = {};
    this.refreshList();
  }
  refreshList() {
    this.teleporterList = resolveComponentList(
      "PortalComponent",
      this.entities,
    );
    this.teleportHash = {};
    this.teleporterList.forEach((teleporter) => {
      this.teleportHash[teleporter.id] = teleporter;
    });
    console.log(this.teleportHash);
  }

  beginTeleport(event) {
    // console.log(trigger, activator);
    const portalSubject = event.activator.getComponent("MovementComponent");
    const sendingPortal = event.trigger.getComponent("PortalComponent");
    const exitPortal = this.teleportHash[sendingPortal.target];

    const exitMovement = exitPortal.entity.getComponent("MovementComponent");
    console.log(exitMovement);

    // const forwardX = Math.cos(exitMovement.angle);
    // const forwardY = Math.sin(exitMovement.angle);

    const EXIT_OFFSET = 10;

    portalSubject.x =
      exitMovement.x + Math.cos(exitMovement.angle) * EXIT_OFFSET;

    portalSubject.y =
      exitMovement.y + Math.sin(exitMovement.angle) * EXIT_OFFSET;

    portalSubject.z = exitMovement.z;

    portalSubject.angle = exitMovement.angle;

    this.particles.spawn({
      x: exitMovement.x + Math.cos(exitMovement.angle) * (EXIT_OFFSET + 4),
      y: exitMovement.y + Math.sin(exitMovement.angle) * (EXIT_OFFSET + 4),
      z: portalSubject.z,
    });

    // this;
    // const destination;
  }
}
