export let spriteLayers = {};

export function initialiseSpriteLayers() {
  spriteLayers = {};
  spriteLayers.bg0 = game.add.group();
  spriteLayers.bg1 = game.add.group();
  spriteLayers.bg2 = game.add.group();
  spriteLayers.bg4 = game.add.group();
  spriteLayers.fg0 = game.add.group();
  spriteLayers.fg1 = game.add.group();
  spriteLayers.fg2 = game.add.group();
  spriteLayers.fg3 = game.add.group();
  spriteLayers.fg4 = game.add.group();
  spriteLayers.fg5 = game.add.group();
  spriteLayers.fg6 = game.add.group();
  spriteLayers.lighting = game.add.group();
  spriteLayers.shadows = game.add.group();
  spriteLayers.debug = game.add.group();
}
