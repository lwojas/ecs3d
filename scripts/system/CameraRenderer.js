import { runtimeBindings, getBindings } from "../tools/runtimeBindings.js";

export class CameraRenderer {
  constructor(raycaster, userId) {
    this.runtimeBindings = getBindings(userId);
    this.raycaster = raycaster;
    this.boundCamera = this.runtimeBindings.boundCamera;
    this.sprites = [];
    this.lights = [];
    // Debug-only wireframe shapes (see Raycaster.renderDebugWireframes /
    // CollisionSystem.debug). Same array-per-frame contract as sprites/lights.
    this.debugObjects = [];
    this.ambient = 0.35;
    // This frame's lighting at the camera's own position -- for callers
    // that light something the raycaster never sees, e.g. a first-person
    // weapon/item viewmodel drawn as an ordinary 2D sprite rather than a
    // camera.sprites entry (see ItemRegistry.setLightTint()). Computed via
    // raycaster.lastLighting so it doesn't re-resolve camera.lights a
    // second time. {r:1,g:1,b:1} (a no-op multiplier) until the first
    // render happens.
    this.viewmodelLight = { r: 1, g: 1, b: 1 };
  }

  update() {
    const target = this.runtimeBindings.boundCamera;
    if (!target) return;
    target.z = this.raycaster.getEyeHeightWorld(target.x, target.y);
    // this.boundCamera = target;
    const camera = this.raycaster.createCameraSnapshot(target);
    camera.pitch = target.viewAngle;
    camera.sprites = this.sprites;
    camera.lights = this.lights;
    camera.debugObjects = this.debugObjects;
    camera.ambient = this.ambient;
    this.raycaster.renderSnapshot(camera);

    const { ambient, lights } = this.raycaster.lastLighting;
    this.viewmodelLight = this.raycaster.sampleLightRgb(
      target.x,
      target.y,
      target.z,
      ambient,
      lights,
    );

    this.sprites.length = 0;
    this.lights.length = 0;
    this.debugObjects.length = 0;
  }
}
