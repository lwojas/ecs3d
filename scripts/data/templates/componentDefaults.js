// AUTO-GENERATED from componentDefaults.json by tools/build-data.js -- do not edit by hand.
export default {
  "player": {
    "MovementComponent": {},
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
  },
  "enemy": {
    "SpriteComponent": {
      "x": 28,
      "y": 14,
      "texture": "enemy1",
      "scale": 6
    },
    "MovementComponent": {
      "x": 28,
      "y": 14,
      "z": 2
    },
    "CollisionComponent": {
      "layer": "NPC"
    },
    "AIComponent": {
      "disposition": "enemy",
      "viewDistance": 100,
      "attackRadius": 30
    },
    "ItemComponent": {},
    "InventoryComponent": {
      "items": [
        "pistol"
      ],
      "equipped": "pistol"
    },
    "PatrolComponent": {
      "patrolPoints": [
        {
          "x": 20,
          "y": 14
        },
        {
          "x": 44,
          "y": 14
        }
      ]
    },
    "HealthComponent": {},
    "ActorComponent": {
      "team": "enemy"
    }
  },
  "enemyHunter": {
    "SpriteComponent": {
      "x": 28,
      "y": 14,
      "texture": "enemy1",
      "scale": 6
    },
    "MovementComponent": {
      "x": 28,
      "y": 14,
      "z": 2
    },
    "CollisionComponent": {
      "layer": "NPC"
    },
    "AIComponent": {
      "disposition": "enemy",
      "viewDistance": 100,
      "attackRadius": 30
    },
    "HuntingComponent": {},
    "ItemComponent": {},
    "InventoryComponent": {
      "items": [
        "pistol"
      ],
      "equipped": "pistol"
    },
    "HealthComponent": {},
    "ActorComponent": {
      "team": "enemy"
    }
  },
  "trigger": {
    "MovementComponent": {
      "movable": false
    },
    "CollisionComponent": {
      "radius": 4,
      "height": 8,
      "layer": "TRIGGER"
    }
  },
  "pickup": {
    "SpriteComponent": {
      "texture": "health",
      "scale": 2,
      "billboard": false,
      "angle": 45
    },
    "MovementComponent": {
      "z": 0,
      "y": 24,
      "movable": false
    },
    "CollisionComponent": {
      "radius": 2,
      "height": 2,
      "layer": "TRIGGER"
    },
    "PickupComponent": {},
    "TriggerComponent": {
      "once": false,
      "onEnter": [
        {
          "event": "resource.add"
        }
      ]
    },
    "TransformComponent": {}
  },
  "portal": {
    "SpriteComponent": {
      "texture": "portal",
      "scale": 2,
      "billboard": true,
      "angle": 45
    },
    "MovementComponent": {
      "z": 0,
      "y": 24,
      "angle": 0,
      "movable": false
    },
    "CollisionComponent": {
      "radius": 2,
      "height": 2,
      "layer": "TRIGGER"
    },
    "TriggerComponent": {
      "once": false,
      "onEnter": [
        {
          "event": "portal.activate"
        }
      ]
    },
    "PortalComponent": {
      "name": "portal1",
      "target": "portal2"
    },
    "TransformComponent": {}
  },
  "door": {
    "DoorComponent": {
      "state": "closed"
    },
    "CellComponent": {
      "cellId": "5"
    }
  }
};
