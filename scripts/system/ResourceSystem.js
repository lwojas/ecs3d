import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";

export class ResourceSystem extends System {
  constructor() {
    super();
    // this.entities = this.entityManager.registerSystem(this, [
    //   "ResourceComponent",
    // ]);
    // this.resourceComponentList = resolveComponentList(
    //   "RecourceComponent",
    //   this.entities,
    // );
    // this.pickUps = {};
    // this.pickUps.entities = this.entityManager.registerSystem(this, [
    //   "PickupComponent",
    // ]);
  }
}

export function addResource(resourceComponent, pickupComponent) {
  switch (pickupComponent.category) {
    case "ammo":
      if (!resourceComponent) return;
      resourceComponent.resources[pickupComponent.type] +=
        pickupComponent.amount;
      break;

    default:
      break;
  }
}

export function checkResource(resourceName, entity) {
  //   console.log(resource, entity);
  const resources = entity.getComponent("ResourceComponent").resources;
  //   console.log(resources);
  //   if (!resources) return;
  if (resources[resourceName] && resources[resourceName] > 0) {
    return resources;
  }
}

export function consumeResource(resource, entity) {
  if (!entity.hasComponent("ResourceComponent")) return;
  const resources = entity.getComponent("ResourceComponent").resources;
  const currentResource = resources[resource];
  if (!currentResource) return;
}
