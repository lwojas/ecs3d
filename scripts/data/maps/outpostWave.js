// AUTO-GENERATED from outpostWave.json by tools/build-data.js -- do not edit by hand.
export default {
  "width": 16,
  "height": 10,
  "defaultCeilingHeight": 2.5,
  "defaultFloorHeight": 0,
  "cellSize": 4,
  "ambient": 0.2,
  "sky": {
    "texture": "skyTexture"
  },
  "map": [
    "1111111111111111",
    "1111110000111111",
    "1111110000111111",
    "1000004004000001",
    "1000000000030001",
    "1000000000030001",
    "1000000000000001",
    "1111111111111111",
    "1111111111111111",
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
        "distance": 20,
        "color": {
          "r": 15,
          "g": 10,
          "b": 8
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
        "distance": 20,
        "color": {
          "r": 15,
          "g": 10,
          "b": 8
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
      "ceilingHeight": 8,
      "sections": [
        {
          "bottom": 0,
          "top": 1.5,
          "material": {
            "texture": "wallTexture",
            "width": 4,
            "height": 4
          }
        },
        {
          "bottom": 5,
          "top": 8,
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
    "start": {
      "cellX": 2.5,
      "cellY": 4.5,
      "angle": 0
    },
    "enemyStart": {
      "cellX": 13.5,
      "cellY": 4.5,
      "angle": 3.14159
    },
    "hostileA": {
      "cellX": 13.5,
      "cellY": 3.5,
      "angle": 3.14159
    },
    "hostileB": {
      "cellX": 13.5,
      "cellY": 5.5,
      "angle": 3.14159
    },
    "hostileC": {
      "cellX": 7.5,
      "cellY": 1.5,
      "angle": 1.5708
    },
    "resupply": {
      "cellX": 8.5,
      "cellY": 1.5,
      "angle": 0
    },
    "lightsTrigger": {
      "cellX": 7.5,
      "cellY": 4.5,
      "angle": 0
    }
  },
  "spawnZones": {
    "start": [
      "start"
    ],
    "hostiles": [
      "hostileA",
      "hostileB",
      "hostileC"
    ]
  }
};
