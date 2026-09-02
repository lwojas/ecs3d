// AUTO-GENERATED from testMap.json by tools/build-data.js -- do not edit by hand.
export default {
  "width": 16,
  "height": 16,
  "defaultCeilingHeight": 2.5,
  "defaultFloorHeight": 0,
  "cellSize": 4,
  "ambient": 0.24,
  "sky": {
    "texture": "skyTexture"
  },
  "map": [
    "1111111111111111",
    "1000000000000001",
    "1000000000000001",
    "1000000000000001",
    "1000011111000001",
    "1000000001000001",
    "1000040001000001",
    "1000010001000001",
    "1000010301000001",
    "1000010001000001",
    "1000010222000001",
    "1000000000000001",
    "1000000000000001",
    "1000000000000001",
    "1000000000000001",
    "1111111111111111"
  ],
  "cells": {
    "0": {
      "name": "Empty",
      "floorHeight": 0,
      "ceilingHeight": 2.5,
      "wall": null,
      "floor": {
        "texture": "floorTexture",
        "width": 4,
        "height": 4
      },
      "ceiling": null,
      "fog": {
        "distance": 24,
        "color": {
          "r": 29,
          "g": 6,
          "b": 6
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
        "distance": 24,
        "color": {
          "r": 29,
          "g": 6,
          "b": 6
        }
      }
    },
    "2": {
      "name": "Brick",
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
        "distance": 24,
        "color": {
          "r": 90,
          "g": 90,
          "b": 100
        }
      }
    },
    "3": {
      "name": "Low Wall",
      "floorHeight": 0,
      "ceilingHeight": 0.5,
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
    },
    "4": {
      "name": "Sectioned Wall",
      "floorHeight": 0,
      "ceilingHeight": 12,
      "sections": [
        {
          "bottom": 0,
          "top": 1,
          "material": {
            "texture": "wallTexture",
            "width": 4,
            "height": 4
          }
        },
        {
          "bottom": 6,
          "top": 12,
          "material": {
            "texture": "wallTexture",
            "width": 4,
            "height": 4
          }
        }
      ],
      "floor": {
        "texture": "floorTexture",
        "width": 4,
        "height": 4
      },
      "ceiling": {
        "texture": "ceilingTexture",
        "width": 4,
        "height": 4
      }
    }
  },
  "spawnPoints": {
    "playerStart": {
      "cellX": 3.5,
      "cellY": 3.5,
      "angle": 0
    },
    "playerStart2": {
      "cellX": 10.5,
      "cellY": 2.5,
      "angle": 0
    },
    "enemySpawn": {
      "cellX": 7,
      "cellY": 3.5,
      "angle": 0
    },
    "courtyardA": {
      "cellX": 5,
      "cellY": 3.5,
      "angle": 0
    },
    "courtyardB": {
      "cellX": 11,
      "cellY": 3.5,
      "angle": 0
    },
    "lightsTrigger": {
      "cellX": 4.5,
      "cellY": 3.5,
      "angle": 0
    }
  },
  "spawnZones": {
    "courtyard": [
      "courtyardA",
      "courtyardB"
    ],
    "players": [
      "playerStart",
      "playerStart2"
    ]
  }
};
