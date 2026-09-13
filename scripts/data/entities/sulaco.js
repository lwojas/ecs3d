// AUTO-GENERATED from sulaco.json by tools/build-data.js -- do not edit by hand.
export default [
  {
    "type": "lightFlicker",
    "uniqueId": "lightFlicker_1",
    "components": {
      "LightComponent": {},
      "TweenComponent": {
        "tweens": [
          {
            "id": "flicker",
            "component": "LightComponent",
            "property": [
              "intensity"
            ],
            "from": 0.5,
            "to": 1.5,
            "duration": 100,
            "loop": true,
            "yoyo": true,
            "active": true
          }
        ]
      },
      "MovementComponent": {
        "x": 16,
        "y": 16,
        "z": 4
      }
    }
  },
  {
    "type": "player",
    "uniqueId": "player_1",
    "components": {
      "MovementComponent": {
        "movable": true,
        "x": 10,
        "y": 10,
        "z": 0
      },
      "ItemComponent": {},
      "InventoryComponent": {},
      "HealthComponent": {},
      "ActorComponent": {},
      "CollisionComponent": {
        "radius": 0.5,
        "offsetZ": 1,
        "layer": "PLAYER",
        "mask": [
          "NPC",
          "PROJECTILE",
          "TRIGGER"
        ]
      },
      "HudComponent": {}
    }
  }
];
