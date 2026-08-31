import { Gameplay } from "./api/rules/Gameplay.js";
import { SinglePlayerRules } from "./api/rules/SinglePlayerRules.js";
import { User } from "./api/rules/User.js";
import { Whiteroom } from "./level-whiteroom.js";
import { SinglePlayerWhiteroom } from "./level-singleplayer-whiteroom.js";
import { MultiplayerWhiteroom } from "./level-multiplayer-whiteroom.js";
import { singlePlayerSession } from "./api/session/sessions.js";

// const gameplay = new Gameplay({
//   rules: new SinglePlayerRules({
//     spawn: {
//       x: 10,
//       y: 10,
//     },
//   }),
// });
// const player = new User({
//   id: "player-1",

//   state: {
//     health: 100,
//     ammo: 20,
//     inventory: {
//       items: ["pistol"],
//       equipped: "pistol",
//     },
//   },
// });
// gameplay.addPlayer(player);
// gameplay.loadMap("e1m1");
// gameplay.start();

// BasicGame.gameplay = gameplay;

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
    this.load.image("health", "assets/items/health.png");
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

    // The session/spawning test level -- see level-singleplayer-whiteroom.js.
    // "Whiteroom" (the pre-session state) is still registered below and
    // reachable by starting it directly, kept as a rollback path.
    game.state.start("SinglePlayerWhiteroom", true, false, singlePlayerSession);
  },
};

// This sets up the Phaser game state on the canvas and sets the camera resolution

// navigator.gamepadInputEmulation = "gamepad";
// BasicGame.ScreenHeight = 720;

// BasicGame.ScreenWidth =
//   (window.screen.availWidth / window.screen.availHeight) *
//   BasicGame.ScreenHeight;

// var game = new Phaser.Game(
//   BasicGame.ScreenWidth,
//   BasicGame.ScreenHeight,
//   Phaser.CANVAS,
//   ""
// );

// Add game states and start the game
window.onload = function () {
  game.state.add("Boot", BasicGame.Boot);
  game.state.add("Whiteroom", Whiteroom);
  game.state.add("SinglePlayerWhiteroom", SinglePlayerWhiteroom);
  game.state.add("MultiplayerWhiteroom", MultiplayerWhiteroom);
  game.state.start("Boot");
};

//Register the service worker if available.
// if ('serviceWorker' in navigator) {
// 		window.addEventListener('load', () => {
// 	    navigator.serviceWorker.register('./sw.js').then(function(reg) {
// 	        console.log('Successfully registered service worker', reg);
// 	    }).catch(function(err) {
// 	        console.warn('Error whilst registering service worker', err);
// 	    });
//   	});
// }
