import { GameplaySession } from "./api/session/GameplaySession.js";
import { Whiteroom } from "./level-whiteroom.js";
import { SinglePlayerWhiteroom } from "./level-singleplayer-whiteroom.js";
import { MultiplayerWhiteroom } from "./level-multiplayer-whiteroom.js";
import { GameMenu } from "./ui/GameMenu.js";
import { Scoreboard } from "./ui/Scoreboard.js";

// Which Phaser state hosts a given gameMode's gameplay -- the only
// mapping the application layer needs; everything else about a mode
// (rules class, spawn behaviour) is already decided by
// createRulesForSession()/MapWorld.
const STATE_BY_MODE = {
  deathmatch: "MultiplayerWhiteroom",
};
const DEFAULT_GAMEPLAY_STATE = "SinglePlayerWhiteroom";

BasicGame.Boot = function (game) {};

// Note to self, replaced 'game' with 'this'

BasicGame.Boot.prototype = {
  init: function () {
    //console.log('Init has fired');
    this.game.stage.smoothed = false;
  },

  preload: function () {
    this.load.spritesheet("Cobra", "assets/_ship_default.png", 32, 32);
    this.load.image("wallTexture", "assets/textures/wall.png");
    this.load.image("floorTexture", "assets/textures/floor.png");
    this.load.image("ceilingTexture", "assets/textures/ceiling.png");
    this.load.image("brickTexture", "assets/textures/brick.png");
    this.load.image("skyTexture", "assets/textures/sky.png");
    this.load.image("pixelWhite", "assets/_pixel_white.png");
    this.load.image("Plasma", "assets/projectiles/plasma.png");
    this.load.image("doorTexture", "assets/textures/door.png");
    this.load.image("health", "assets/items/health.png");
    this.load.image("keyRed", "assets/items/key_red.png");
    this.load.image("bloodDrop", "assets/particles/blood.png");
    this.load.image("portal", "assets/mapObjects/portal.png");
    this.load.image("enemy1", "assets/npc/cobra0.png");
    this.load.image("portalParticle", "assets/particles/portalParticle.png");

    // Audio
    this.load.audio("sfx_pickup", "assets/audio/gui/positive.wav");

    this.load.spritesheet(
      "hudShotgun",
      "assets/hud/item_shotgun.png",
      130,
      200,
    );

    this.load.spritesheet(
      "hudDecoupler",
      "assets/hud/item_plasma_decoupler.png",
      130,
      200,
    );

    // this.load.image("dysonLight", "assets/_light_ship2.png");
  },

  create: function () {
    game.stage.backgroundColor = "#999";
    this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL; // Scale the canvas to fit the whole window
    // this.world.setBounds(0, 0, 2000, 2000); // Set the size of the game world - this is not the size of the camera
    this.time.advancedTiming = true;
    // this.physics.startSystem(Phaser.Physics.ARCADE);
    // game.camera.roundPx = false; // stops the sprite from jittering.
    // game.camera.lerp = 0.5;

    // Nothing to render until the HTML menu (see GameMenu.js) starts a
    // session -- "Menu" is an intentionally blank Phaser state, kept
    // separate from "Boot" so returning to the menu later doesn't
    // re-run preload().
    game.state.start("Menu");
  },
};

BasicGame.Menu = function (game) {};
BasicGame.Menu.prototype = {
  create: function () {
    game.stage.backgroundColor = "#14161a";
  },
};

// The application layer: the one place that turns a menu-produced
// sessionConfig into the existing persistent-session/map-state startup
// (GameplaySession -> MapWorld -> Phaser state), and the one place that
// tears a running session down to return to the menu. The menu itself
// never constructs any of this -- see GameMenu.js.
function startGameplay(sessionConfig) {
  new GameplaySession(sessionConfig, { onGameOver: showScoreboard });
  gameMenu.hide();
  game.state.start(
    STATE_BY_MODE[sessionConfig.gameMode] ?? DEFAULT_GAMEPLAY_STATE,
  );
}

function returnToMenu() {
  game.state.start("Menu");
  gameMenu.show();
}

// gameplay.finish() (see Gameplay.js) is the one funnel every rule's
// game-over routes through -- GameplaySession's onGameOver callback
// fires this the instant a session ends, so nothing here needs to poll
// gameplay state per frame.
function showScoreboard(outcome) {
  game.state.start("Menu"); // tears down the current MapWorld, same as returnToMenu()
  scoreboard.show(outcome);
}

function restartToMenu() {
  scoreboard.hide();
  returnToMenu();
}

let gameMenu;
let scoreboard;

// Add game states and start the game
window.onload = function () {
  gameMenu = new GameMenu(document.getElementById("game-menu"), {
    onStart: startGameplay,
  });
  scoreboard = new Scoreboard(document.getElementById("scoreboard"), {
    onRestart: restartToMenu,
  });

  // Minimal, event-driven (not polled) way back to the menu from
  // gameplay -- Phaser's state.start() below tears down the current
  // MapWorld via its own shutdown(), same as any other state swap.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") returnToMenu();
  });

  game.state.add("Boot", BasicGame.Boot);
  game.state.add("Menu", BasicGame.Menu);
  game.state.add("Whiteroom", Whiteroom);
  game.state.add("SinglePlayerWhiteroom", SinglePlayerWhiteroom);
  game.state.add("MultiplayerWhiteroom", MultiplayerWhiteroom);
  game.state.start("Boot");
};
