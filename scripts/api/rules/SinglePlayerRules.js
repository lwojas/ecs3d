import { GameRules } from "./GameRules.js";

export class SinglePlayerRules extends GameRules {
  constructor({ spawn = null, respawn = {} } = {}, gameplay) {
    super();

    this.config = {
      spawn,
      respawn: {
        resetLevel: true,
        restorePlayerState: true,
        ...respawn,
      },
    };
  }

  events = {
    "player.died": "onPlayerDied",
    "entity.moving": "onPlayerDied",
    "entity.damaged": "onEntityDamaged",
  };

  onEntityDamaged(gameplay, message) {
    const entity = message.target.entity;
    // console.log(gameplay, message.currentHealth, message.target);
    if (message.currentHealth <= 0) {
      entity.disable();
    }
    const player = gameplay.getPlayer(entity.id);
    // if (player.)
    // console.log(player);
    if (player && message.currentHealth <= 0) {
      gameplay.addAction({
        type: "player.respawn",
        playerId: player.id,
        spawn: this.config.spawn,
        restoreState: this.config.respawn.restorePlayerState,
      });
    }
  }

  onStart(gameplay) {
    // Rules can initialise gameplay state here.
  }

  onPlayerDied(gameplay, message) {
    console.log("On player died firing!");
    const player = gameplay.getPlayer(message.playerId);

    if (!player) return;

    if (this.config.respawn.resetLevel) {
      gameplay.addAction({
        type: "map.reset",
      });
    }

    gameplay.addAction({
      type: "player.respawn",
      playerId: player.id,
      spawn: this.config.spawn,
      restoreState: this.config.respawn.restorePlayerState,
    });
  }
}
