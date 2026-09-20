import { resolveComponentList } from "../tools/componentResolver.js";
import { System } from "./System.js";
import { resourceData } from "./resourceData.js";

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

function checkIfFull(amount1, resourceType) {
  if (amount1 >= resourceData[resourceType].total) {
    return true;
  }
  return false;
}

export function addResource(pickupComponent, resourceComponent) {
  if (!resourceComponent) return;
  const itemName = pickupComponent.itemName;
  const resources = resourceComponent.resources;
  // console.log(pickupComponent, resourceComponent);
  const amount = pickupComponent.amount;
  const resourceAmount = resources[itemName];
  if (!resourceAmount) return;
  if (checkIfFull(resourceAmount, itemName)) return true;

  resources[itemName] = Math.min(
    amount + resources[itemName],
    resourceData[itemName].total,
  );
  return false;
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
