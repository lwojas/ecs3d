import { Gameplay } from "../rules/Gameplay.js";
import { User } from "../rules/User.js";
import { createRulesForSession } from "./createRulesForSession.js";
import { resolveSessionPlayers } from "./sessions.js";
import { ServiceLocator } from "../../services/ServiceLocator.js";

// The persistent half of the session lifecycle. Created once -- today by
// boot.js, eventually by a menu/configurator -- and survives every
// Phaser map-state/world transition. Owns exactly what must outlive a
// map: game rules, the Gameplay orchestrator, and the persistent Users.
//
// Everything map-specific (map/entity data, raycaster, EntityManager,
// EntitySpawner, ECS world, HUD/camera/input) belongs to MapWorld
// instead -- see MapWorld.js, which is built fresh per map load from a
// GameplaySession rather than owning any of this itself.
//
// Gameplay's own constructor already registers itself in ServiceLocator
// as ("system", "GameplayManager"); this class additionally registers
// itself as ("system", "GameplaySession") so a Phaser map state can
// resolve the whole persistent session (config + gameplay/rules) rather
// than constructing a new one per map.
export class GameplaySession {
  constructor(sessionConfig) {
    this.config = sessionConfig;
    this.rules = createRulesForSession(sessionConfig);
    this.gameplay = new Gameplay({ rules: this.rules });

    // Gameplay owns the player/user collection -- users are never
    // registered globally on their own.
    for (const sessionPlayer of resolveSessionPlayers(sessionConfig)) {
      this.gameplay.addPlayer(new User(sessionPlayer));
    }

    ServiceLocator.register("system", "GameplaySession", this);
  }
}
