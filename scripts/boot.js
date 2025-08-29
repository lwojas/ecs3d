import { Whiteroom } from "./level-whiteroom.js";

BasicGame.Boot = function (game) {};

// Note to self, replaced 'game' with 'this'

BasicGame.Boot.prototype = {
  init: function () {
    //console.log('Init has fired');
    this.game.stage.smoothed = false;
  },

  preload: function () {
    this.load.spritesheet("Cobra", "assets/_ship_default.png", 32, 32);
    this.load.spritesheet(
      "defaultObject",
      "assets/_default_object.png",
      16,
      16
    );
    this.load.spritesheet("defaultPawn", "assets/_default_pawn.png", 16, 16);
    this.load.image("pixelWhite", "assets/_pixel_white.png");
    this.load.image("shipTurretDefault", "assets/_ship_turret_default.png");
    this.load.image("defaultLight", "assets/_light_default.png");
    this.load.image("starfield", "assets/_bg_nebula.png");
    this.load.image("lightShip", "assets/_light_ship2.png");
    // this.load.image("dyson", "assets/_dyson.png");
    // this.load.image("dysonLight", "assets/_light_ship2.png");
  },

  create: function () {
    game.stage.backgroundColor = "#999";
    this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL; // Scale the canvas to fit the whole window
    this.world.setBounds(0, 0, 5000, 5000); // Set the size of the game world - this is not the size of the camera
    this.time.advancedTiming = true;
    this.physics.startSystem(Phaser.Physics.ARCADE);
    game.camera.roundPx = false; // stops the sprite from jittering.
    // game.camera.lerp = 0.5;

    game.state.start("Whiteroom"); // Load the first level
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
