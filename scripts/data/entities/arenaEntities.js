// AUTO-GENERATED from arenaEntities.json by tools/build-data.js -- do not edit by hand.
export default [
  {
    "type": "pickup",
    "uniqueId": "pickup_mid_north",
    "components": {
      "MovementComponent": {
        "x": 38,
        "y": 18,
        "z": 0
      }
    }
  },
  {
    "type": "pickup",
    "uniqueId": "pickup_mid_south",
    "components": {
      "MovementComponent": {
        "x": 38,
        "y": 62,
        "z": 0
      }
    }
  },
  {
    "type": "light",
    "uniqueId": "light_pillar_nw",
    "components": {
      "LightComponent": {
        "enabled": true,
        "x": 26,
        "y": 26
      }
    }
  },
  {
    "type": "light",
    "uniqueId": "light_pillar_ne",
    "components": {
      "LightComponent": {
        "enabled": true,
        "x": 54,
        "y": 26
      }
    }
  },
  {
    "type": "light",
    "uniqueId": "light_pillar_sw",
    "components": {
      "LightComponent": {
        "enabled": false,
        "x": 26,
        "y": 54
      }
    }
  },
  {
    "type": "light",
    "uniqueId": "light_pillar_se",
    "components": {
      "LightComponent": {
        "enabled": false,
        "x": 54,
        "y": 54
      }
    }
  },
  {
    "type": "trigger",
    "uniqueId": "trigger_courtyard_lights",
    "components": {
      "SpawnComponent": {
        "point": "courtyardA"
      },
      "TriggerComponent": {
        "once": false,
        "onEnter": [
          {
            "event": "lights.set",
            "data": {
              "on": [
                "light_pillar_sw",
                "light_pillar_se"
              ],
              "off": [
                "light_pillar_nw",
                "light_pillar_ne"
              ]
            }
          }
        ]
      }
    }
  }
];
