import { getBindings } from "../tools/runtimeBindings.js";

export class CameraRenderer {
  constructor(raycaster, userId) {
    this.runtimeBindings = getBindings(userId);

    this.raycaster = raycaster;

    this.boundCamera = this.runtimeBindings.boundCamera;

    this.sprites = [];
    this.lights = [];
    this.debugObjects = [];

    // One-shot lights (e.g. muzzle flashes) that need to survive a couple
    // of render ticks rather than exactly one: `this.lights` is rebuilt
    // from scratch and truncated every update() call, so a light pushed
    // straight onto it only ever gets included in the single render that
    // happens to run before the next update() -- if that particular tick's
    // render/composite gets skipped (Phaser can do this to catch up after
    // a stall), the light is gone without ever having been seen. Tracking
    // these separately, by remaining real time rather than tick count,
    // means a skipped frame just means it's still around for the next one.
    this.transientLights = [];

    this.ambient = 0.35;

    this.viewmodelLight = {
      r: 1,
      g: 1,
      b: 1,
    };

    this.renderZ = null;

    // Reused every frame as the input to createCameraSnapshot() instead of
    // spreading `target` into a fresh object -- avoids both the allocation
    // and copying fields (speed, moveX, verticalVelocity, ...) the
    // raycaster never reads.
    this.cameraInput = { x: 0, y: 0, z: 0, angle: 0 };
  }

  resetCameraZ() {
    this.renderZ = null;
  }

  // duration is real time (seconds), not a frame/tick count -- deliberately,
  // so a render tick Phaser decides to skip doesn't cost the light its only
  // chance to be seen (see this.transientLights' constructor comment).
  addTransientLight(light, duration = 0.05) {
    this.transientLights.push({ light, remaining: duration });
  }

  update(delta) {
    const target = this.runtimeBindings.boundCamera;

    if (!target) {
      return;
    }

    // MovementSystem owns target.z (the entity's physical base/standing
    // height, shared with every other movable entity). CameraRenderer only
    // smooths its own rendered eye height and must never write back to it.
    const eyeZ = target.z + this.raycaster.cameraHeight;

    if (this.renderZ === null) {
      this.renderZ = eyeZ;
    } else {
      const dz = eyeZ - this.renderZ;

      if (dz > 0) {
        // Stepping up onto a higher surface (stairs) is an instant snap in
        // MovementSystem -- soften the pop instead of popping the camera.
        const zSpeed = 8;
        this.renderZ += Math.min(dz, zSpeed * delta);
      } else {
        // Falling is already a real, accelerating gravity curve from
        // MovementSystem -- don't cap it, or the camera lags behind the
        // actual fall speed.
        this.renderZ = eyeZ;
      }
    }

    const input = this.cameraInput;
    input.x = target.x;
    input.y = target.y;
    input.z = this.renderZ;
    input.angle = target.angle;

    for (let i = this.transientLights.length - 1; i >= 0; i--) {
      const entry = this.transientLights[i];
      entry.remaining -= delta;
      if (entry.remaining <= 0) {
        this.transientLights.splice(i, 1);
      } else {
        this.lights.push(entry.light);
      }
    }

    const camera = this.raycaster.createCameraSnapshot(input);

    camera.pitch = target.viewAngle;
    camera.sprites = this.sprites;
    camera.lights = this.lights;
    // console.log(camera.lights);
    camera.debugObjects = this.debugObjects;
    camera.ambient = this.ambient;

    this.raycaster.renderSnapshot(camera);

    const { ambient, lights } = this.raycaster.lastLighting;

    this.viewmodelLight = this.raycaster.sampleLightRgb(
      target.x,
      target.y,
      this.renderZ,
      ambient,
      lights,
    );

    this.sprites.length = 0;
    this.lights.length = 0;
    // console.log(this.lights);
    this.debugObjects.length = 0;
  }
}
