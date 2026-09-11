import { ActorComponent } from "../components/ActorComponent.js";
import { AIComponent } from "../components/AIComponent.js";
import { AnimationComponent } from "../components/AnimationComponent.js";
import { CellComponent } from "../components/CellComponent.js";
import { CollisionComponent } from "../components/CollisionComponent.js";
import { CombatMovementComponent } from "../components/CombatMovementComponent.js";
import { DoorComponent } from "../components/DoorComponent.js";
import { HealthComponent } from "../components/HealthComponent.js";
import { HitReactionComponent } from "../components/HitReactionComponent.js";
import { HudComponent } from "../components/HudComponent.js";
import { HuntingComponent } from "../components/HuntingComponent.js";
import { InventoryComponent } from "../components/InventoryComponent.js";
import { ItemComponent } from "../components/ItemComponent.js";
import { LightComponent } from "../components/LightComponent.js";
import { MovementComponent } from "../components/MovementComponent.js";
import { PatrolComponent } from "../components/PatrolComponent.js";
import { PickupComponent } from "../components/PickupComponent.js";
import { PortalComponent } from "../components/PortalComponent.js";
import { ResourceComponent } from "../components/ResourceComponent.js";
import { SpawnComponent } from "../components/SpawnComponent.js";
import { SpriteComponent } from "../components/SpriteComponent.js";

import { TransformComponent } from "../components/TransformComponent.js";
import { TriggerComponent } from "../components/TriggerComponent.js";

export const componentClasses = {
  MovementComponent: MovementComponent,
  SpriteComponent: SpriteComponent,
  CollisionComponent: CollisionComponent,
  LightComponent: LightComponent,
  ItemComponent: ItemComponent,
  AIComponent: AIComponent,
  PatrolComponent: PatrolComponent,
  HuntingComponent: HuntingComponent,
  HealthComponent: HealthComponent,
  ActorComponent: ActorComponent,
  SpawnComponent: SpawnComponent,
  InventoryComponent: InventoryComponent,
  TriggerComponent: TriggerComponent,
  ResourceComponent: ResourceComponent,
  HudComponent: HudComponent,
  TransformComponent: TransformComponent,
  PickupComponent: PickupComponent,
  CellComponent: CellComponent,
  DoorComponent: DoorComponent,
  PortalComponent: PortalComponent,
  AnimationComponent: AnimationComponent,
  CombatMovementComponent: CombatMovementComponent,
  HitReactionComponent: HitReactionComponent,
};
