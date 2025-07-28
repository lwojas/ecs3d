import { InputComponent } from "../components/tags/InputComponent.js";
import { OverlapComponent } from "../components/tags/OverlapComponent.js";
import { TriggerComponent } from "../components/TriggerComponent.js";
import { PhysicsDynamicComponent } from "../components/PhysicsDynamicComponent.js";
import { PlayerComponent } from "../components/tags/PlayerComponent.js";
import { SpriteComponent } from "../components/SpriteComponent.js";
import { StateMovementComponent } from "../components/StateMovementComponent.js";
import { Position } from "../components/TestComponents.js";
import { MovementComponent } from "../components/MovementComponent.js";
import { MotionShipComponent } from "../components/MotionShipComponent.js";
import { ShipPhysicsComponent } from "../components/ShipPhysicsComponent.js";
import { ShipExhaustComponent } from "../components/ShipExhaustComponent.js";
import { WeaponComponent } from "../components/tags/WeaponComponent.js";
import { WeaponControllerComponent } from "../components/WeaponControllerComponent.js";
import { InventoryComponent } from "../components/InventoryComponent.js";
import { TrackerComponent } from "../components/tags/TrackerComponent.js";
import { CheckConditionComponent } from "../components/CheckConditionComponent.js";
import { CameraFollowComponent } from "../components/CameraFollowComponent.js";
import { ProjectileComponent } from "../components/tags/ProjectileComponent.js";
import { AmmoComponent } from "../components/tags/AmmoComponent.js";
import { AmmoItemComponent } from "../components/tags/AmmoItemComponent.js";

export const componentClasses = {
  InputComponent: InputComponent,
  OverlapComponent: OverlapComponent,
  PhysicsDynamicComponent: PhysicsDynamicComponent,
  PlayerComponent: PlayerComponent,
  SpriteComponent: SpriteComponent,
  StateMovementComponent: StateMovementComponent,
  Position: Position,
  PhysicsStaticComponent: PhysicsDynamicComponent,
  TriggerComponent: TriggerComponent,
  MovementComponent: MovementComponent,
  MotionShipComponent: MotionShipComponent,
  ShipPhysicsComponent: ShipPhysicsComponent,
  ShipExhaustComponent: ShipExhaustComponent,
  WeaponComponent: WeaponComponent,
  WeaponControllerComponent: WeaponControllerComponent,
  InventoryComponent: InventoryComponent,
  TrackerComponent: TrackerComponent,
  CheckConditionComponent: CheckConditionComponent,
  CameraFollowComponent: CameraFollowComponent,
  ProjectileComponent: ProjectileComponent,
  AmmoComponent: AmmoComponent,
  AmmoItemComponent: AmmoItemComponent,
};
