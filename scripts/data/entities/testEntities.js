// AUTO-GENERATED from testEntities.json by tools/build-data.js -- do not edit by hand.
export default [
  {
    "type": "player",
    "uniqueId": "player-1",
    "components": {
      "SpawnComponent": {
        "point": "playerStart"
      }
    }
  },
  {
    "type": "pickup",
    "uniqueId": "pickup1",
    "components": {}
  },
  {
    "type": "light",
    "uniqueId": "light_1",
    "components": {
      "LightComponent": {
        "enabled": true,
        "x": 14,
        "y": 14
      }
    }
  },
  {
    "type": "light",
    "uniqueId": "light_2",
    "components": {
      "LightComponent": {
        "enabled": false,
        "x": 28,
        "y": 14
      }
    }
  },
  {
    "type": "light",
    "uniqueId": "light_3",
    "components": {
      "LightComponent": {
        "enabled": false,
        "x": 44,
        "y": 14
      }
    }
  },
  {
    "type": "trigger",
    "uniqueId": "trigger_lights_demo",
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
                "light_2",
                "light_3"
              ],
              "off": [
                "light_1"
              ]
            }
          }
        ]
      }
    }
  },
  {
    "type": "pickup",
    "uniqueId": "pickup_key",
    "components": {
      "SpriteComponent": {
        "texture": "keyRed",
        "scale": 2,
        "billboard": false,
        "angle": 45
      },
      "MovementComponent": {
        "z": 0,
        "y": 30
      },
      "CollisionComponent": {
        "radius": 2,
        "height": 2,
        "layer": "TRIGGER"
      },
      "PickupComponent": {
        "pickupType": "item",
        "itemName": "key01"
      },
      "TriggerComponent": {
        "once": false,
        "onEnter": [
          {
            "event": "resource.add"
          }
        ]
      },
      "TransformComponent": {}
    }
  }
];
