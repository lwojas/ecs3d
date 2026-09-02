// AUTO-GENERATED from outpostEntities.json by tools/build-data.js -- do not edit by hand.
export default [
  {
    "type": "player",
    "uniqueId": "player-1",
    "components": {
      "SpawnComponent": {
        "point": "start"
      }
    }
  },
  {
    "type": "pickup",
    "uniqueId": "pickup_resupply",
    "components": {
      "MovementComponent": {
        "x": 34,
        "y": 6,
        "z": 0
      }
    }
  },
  {
    "type": "light",
    "uniqueId": "light_branch_room",
    "components": {
      "LightComponent": {
        "enabled": false,
        "x": 30,
        "y": 6
      }
    }
  },
  {
    "type": "trigger",
    "uniqueId": "trigger_branch_lights",
    "components": {
      "SpawnComponent": {
        "point": "lightsTrigger"
      },
      "TriggerComponent": {
        "once": true,
        "onEnter": [
          {
            "event": "lights.set",
            "data": {
              "on": [
                "light_branch_room"
              ],
              "off": []
            }
          }
        ]
      }
    }
  }
];
