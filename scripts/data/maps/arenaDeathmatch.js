// AUTO-GENERATED from arenaDeathmatch.json by tools/build-data.js -- do not edit by hand.
export default {
  "width": 20,
  "height": 20,
  "defaultCeilingHeight": 3,
  "defaultFloorHeight": 0,
  "cellSize": 4,
  "ambient": 0.3,
  "sky": {
    "texture": "skyTexture"
  },
  "map": [
    "11111111111111111111",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "10001110000001110001",
    "10000000000000000001",
    "10000020000002000001",
    "10000000000000000001",
    "10000000333300000001",
    "10000000300300000001",
    "10000000300300000001",
    "10000000333300000001",
    "10000000000000000001",
    "10000020000002000001",
    "10000000000000000001",
    "10001110000001110001",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "11111111111111111111"
  ],
  "cells": {
    "0": {
      "name": "Empty",
      "floorHeight": 0,
      "ceilingHeight": 3,
      "wall": null,
      "floor": {
        "texture": "floorTexture",
        "width": 4,
        "height": 4
      },
      "ceiling": null,
      "fog": {
        "distance": 32,
        "color": {
          "r": 10,
          "g": 12,
          "b": 20
        }
      }
    },
    "1": {
      "name": "Wall",
      "floorHeight": 0,
      "ceilingHeight": 8,
      "wall": {
        "texture": "wallTexture",
        "width": 4,
        "height": 4
      },
      "floor": {
        "texture": "floorTexture",
        "width": 4,
        "height": 4
      },
      "ceiling": {
        "texture": "ceilingTexture",
        "width": 4,
        "height": 4
      },
      "fog": {
        "distance": 32,
        "color": {
          "r": 10,
          "g": 12,
          "b": 20
        }
      }
    },
    "2": {
      "name": "Pillar",
      "floorHeight": 0,
      "ceilingHeight": 16,
      "wall": {
        "texture": "brickTexture",
        "width": 2,
        "height": 1.5
      },
      "floor": {
        "texture": "floorTexture",
        "width": 4,
        "height": 4
      },
      "ceiling": {
        "texture": "ceilingTexture",
        "width": 4,
        "height": 4
      },
      "fog": {
        "distance": 32,
        "color": {
          "r": 60,
          "g": 60,
          "b": 70
        }
      }
    },
    "3": {
      "name": "Cover",
      "floorHeight": 0,
      "ceilingHeight": 1,
      "wall": {
        "texture": "brickTexture",
        "width": 2,
        "height": 1.5
      },
      "blocking": false,
      "floor": {
        "texture": "floorTexture",
        "width": 4,
        "height": 4
      },
      "ceiling": {
        "texture": "floorTexture",
        "width": 4,
        "height": 4
      }
    }
  },
  "spawnPoints": {
    "redSpawnA": {
      "cellX": 2.5,
      "cellY": 2.5,
      "angle": 0
    },
    "redSpawnB": {
      "cellX": 17.5,
      "cellY": 17.5,
      "angle": 3.14159
    },
    "blueSpawnA": {
      "cellX": 17.5,
      "cellY": 2.5,
      "angle": 3.14159
    },
    "blueSpawnB": {
      "cellX": 2.5,
      "cellY": 17.5,
      "angle": 0
    },
    "courtyardA": {
      "cellX": 9.5,
      "cellY": 9.5,
      "angle": 0
    },
    "courtyardB": {
      "cellX": 10.5,
      "cellY": 9.5,
      "angle": 1.5708
    },
    "courtyardC": {
      "cellX": 9.5,
      "cellY": 10.5,
      "angle": 3.14159
    },
    "courtyardD": {
      "cellX": 10.5,
      "cellY": 10.5,
      "angle": 4.712
    },
    "midNorth": {
      "cellX": 9.5,
      "cellY": 4.5,
      "angle": 0
    },
    "midSouth": {
      "cellX": 9.5,
      "cellY": 15.5,
      "angle": 3.14159
    },
    "pillarNW": {
      "cellX": 6.5,
      "cellY": 6.5,
      "angle": 0
    },
    "pillarNE": {
      "cellX": 13.5,
      "cellY": 6.5,
      "angle": 0
    },
    "pillarSW": {
      "cellX": 6.5,
      "cellY": 13.5,
      "angle": 0
    },
    "pillarSE": {
      "cellX": 13.5,
      "cellY": 13.5,
      "angle": 0
    }
  },
  "spawnZones": {
    "players": [
      "redSpawnA",
      "redSpawnB",
      "blueSpawnA",
      "blueSpawnB"
    ],
    "courtyard": [
      "courtyardA",
      "courtyardB",
      "courtyardC",
      "courtyardD"
    ],
    "redSpawn": [
      "redSpawnA",
      "redSpawnB"
    ],
    "blueSpawn": [
      "blueSpawnA",
      "blueSpawnB"
    ]
  }
};
