import assert from "node:assert/strict";
import { Raycaster } from "../scripts/system/Raycaster.js";

function createPureRaycaster(overrides = {}) {
  const raycaster = Object.create(Raycaster.prototype);
  Object.assign(
    raycaster,
    {
      width: 320,
      height: 180,
      cellSize: 4,
      cameraHeight: 4,
      focalLength: 277.1281292110204,
      maxDistance: 100,
      visibleIntervalCapacity: 8,
      planeRowFactors: (() => {
        const factors = new Float64Array(180);
        for (let y = 0; y < 180; y++) {
          const offset = y - 90;
          factors[y] =
            Math.abs(offset) < 0.000001 ? Infinity : 277.1281292110204 / offset;
        }
        return factors;
      })(),
    },
    overrides,
  );
  return raycaster;
}

function assertNear(actual, expected, epsilon = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

// Minimal DOM/Phaser stand-ins so the *real* constructor can run under Node.
// createPureRaycaster() above bypasses `new Raycaster(...)` entirely by
// assigning fields onto the prototype directly, which means it can never
// catch a bug in a value the constructor derives (e.g. focalLength being
// computed from the wrong dimension) -- it would just silently re-hardcode
// whatever the mock's author already believed was correct. These stubs let
// tests exercise the constructor itself for exactly that class of bug.
function createFakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext() {
      return {
        imageSmoothingEnabled: true,
        createImageData(width, height) {
          return { data: new Uint8ClampedArray(width * height * 4) };
        },
        // Decoded "texture" pixels: a flat mid-grey, non-zero on every
        // channel so lighting multipliers are visible in tests (a black
        // texture would stay black regardless of any light multiplier).
        getImageData(x, y, width, height) {
          const data = new Uint8ClampedArray(width * height * 4);
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 200;
            data[i + 1] = 200;
            data[i + 2] = 200;
            data[i + 3] = 255;
          }
          return { data };
        },
        drawImage() {},
        putImageData() {},
      };
    },
  };
}

function createFakeGame() {
  return {
    width: 640,
    height: 360,
    add: {
      sprite() {
        return {
          loadTexture() {},
          smoothed: true,
          scale: { set() {} },
          destroy() {},
        };
      },
      bitmapData() {
        return { context: { putImageData() {} }, dirty: false };
      },
    },
    cache: {
      // A small fixed-size fake image for any texture key, so real
      // constructor/render tests can exercise wall/floor/sprite texture
      // decoding without loading real image assets.
      getImage() {
        return { width: 4, height: 4 };
      },
    },
  };
}

function withFakeDom(fn) {
  const hadDocument = Object.prototype.hasOwnProperty.call(
    globalThis,
    "document",
  );
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => createFakeCanvas() };
  try {
    return fn();
  } finally {
    if (hadDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
  }
}

function testWorldProjection() {
  const raycaster = createPureRaycaster();
  assert.equal(raycaster.projectWorldZ(4, 10), 90);
  assertNear(raycaster.projectWorldZ(8, 10), 90 - raycaster.focalLength * 0.4);
  assertNear(raycaster.projectWorldZ(0, 10), 90 + raycaster.focalLength * 0.4);
  assert.equal(raycaster.projectWorldZ(4, 0), 90);
}

// Regression test for a real shipped bug: a caller (ItemSystem's
// fireFromCamera) fed a pixel/degree-scale "pitch" value straight into
// Math.cos/sin as if it were radians, producing an erratic, wrapping
// firing direction as the player looked up/down. getForwardVector() exists
// specifically so gameplay callers have one correct, real-radians
// implementation instead of reimplementing this trig inline.
function testGetForwardVector() {
  // Level aim (pitch 0), facing along +x: forward is exactly +x, no
  // vertical component.
  assertNear(Raycaster.getForwardVector(0, 0).x, 1);
  assertNear(Raycaster.getForwardVector(0, 0).y, 0);
  assertNear(Raycaster.getForwardVector(0, 0).z, 0);

  // Facing along +y (angle = PI/2), still level.
  assertNear(Raycaster.getForwardVector(Math.PI / 2, 0).x, 0);
  assertNear(Raycaster.getForwardVector(Math.PI / 2, 0).y, 1);

  // Looking straight up (pitch = PI/2): forward collapses to pure +z,
  // regardless of horizontal angle.
  const up = Raycaster.getForwardVector(0, Math.PI / 2);
  assertNear(up.x, 0, 1e-9);
  assertNear(up.z, 1);

  // Looking straight down (pitch = -PI/2): pure -z.
  const down = Raycaster.getForwardVector(0, -Math.PI / 2);
  assertNear(down.z, -1);

  // pitchRadians defaults to 0 (level aim) when omitted.
  assert.deepEqual(
    Raycaster.getForwardVector(1.2),
    Raycaster.getForwardVector(1.2, 0),
  );

  // The result is always a unit vector.
  const result = Raycaster.getForwardVector(0.7, 0.4);
  assertNear(
    Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2),
    1,
  );
}

// Regression test for a second, subtler version of the same bug: even
// after routing through getForwardVector(), a caller (ItemSystem's
// fireFromCamera) converted camera.pitch to radians via a fixed
// degrees/radians factor. camera.pitch is not an angle at all -- it's a
// screen-space horizon shift in pixels (see raycaster-api.md) -- so no
// fixed conversion factor can match the rendered view; the true
// equivalent angle depends on focalLength. getCameraForwardVector() is
// the one authoritative place that conversion happens. The property this
// test checks is the one that actually matters: a world point straight
// ahead along the derived forward vector must project back to screen
// centre, i.e. it points at exactly what the crosshair is showing.
function testGetCameraForwardVector() {
  const raycaster = createPureRaycaster();

  const level = raycaster.getCameraForwardVector({ angle: 0, pitch: 0 });
  assertNear(level.x, 1);
  assertNear(level.y, 0);
  assertNear(level.z, 0);

  for (const pitchPixels of [10, -10, 80, -80, 150]) {
    const camera = { angle: 0.3, pitch: pitchPixels };
    const forward = raycaster.getCameraForwardVector(camera);

    // projectWorldZ()'s `distance` parameter is a horizontal-plane
    // distance (rays never carry a Z component in this renderer), so a
    // 3D travel length along `forward` must be converted to the matching
    // horizontal distance via the forward vector's own horizontal
    // magnitude before calling it -- exactly mirroring how a caller would
    // place a fired projectile some distance down its own trajectory.
    const travel = 20;
    const horizontalDistance = Math.hypot(forward.x, forward.y) * travel;
    const worldZ = raycaster.cameraHeight + forward.z * travel;

    // Mirrors what updateProjection(camera) would set for this camera.
    raycaster.renderHorizon = raycaster.height / 2 + pitchPixels;
    raycaster.renderCameraHeight = raycaster.cameraHeight;

    assertNear(
      raycaster.projectWorldZ(worldZ, horizontalDistance),
      raycaster.height / 2,
      1e-6,
    );
  }
}

function testConstructorDerivedProjection() {
  withFakeDom(() => {
    const game = createFakeGame();
    const level = {
      width: 4,
      height: 4,
      map: ["1111", "1001", "1001", "1111"],
      cells: {},
    };

    const wide = new Raycaster(game, level, {
      width: 320,
      height: 180,
      fov: Math.PI / 3,
    });
    // Must match the width-derived constant the pure-mock harness above has
    // hardcoded for this exact width/fov -- the two should never disagree.
    assertNear(wide.focalLength, 277.1281292110204, 1e-6);
    assertNear(wide.focalLength, 320 / 2 / Math.tan(Math.PI / 6));
    assert.equal(wide.columnGeometry.length, 320);
    assert.equal(wide.planeRowFactors.length, 180);

    // A canvas where width and height differ substantially is the case that
    // exposes the bug: focalLength must track `width`, never `height`.
    const tall = new Raycaster(game, level, {
      width: 200,
      height: 600,
      fov: Math.PI / 3,
    });
    assertNear(tall.focalLength, 200 / 2 / Math.tan(Math.PI / 6));
    assert.notEqual(tall.focalLength, 600 / 2 / Math.tan(Math.PI / 6));

    // An FOV change must rebuild focalLength from the same basis, not just
    // whatever the constructor happened to compute once.
    wide.updateProjection({ x: 0, y: 0, angle: 0, fov: Math.PI / 2 });
    assertNear(wide.focalLength, wide.computeFocalLength(Math.PI / 2));
    assertNear(wide.focalLength, 320 / 2 / Math.tan(Math.PI / 4));
  });
}

function testLightResolution() {
  const raycaster = createPureRaycaster();

  assert.deepEqual(raycaster.resolveLights(null), []);
  assert.deepEqual(raycaster.resolveLights([]), []);
  // Non-positive radius or intensity effectively disables a light rather
  // than crashing on malformed/incomplete render input.
  assert.deepEqual(
    raycaster.resolveLights([{ x: 0, y: 0, radius: 0, intensity: 1 }]),
    [],
  );
  assert.deepEqual(
    raycaster.resolveLights([{ x: 0, y: 0, radius: 10, intensity: 0 }]),
    [],
  );

  const [resolved] = raycaster.resolveLights([
    {
      x: 1,
      y: 2,
      z: 3,
      radius: 10,
      intensity: 2,
      tint: { r: 0, g: 128, b: 255 },
    },
  ]);
  assert.equal(resolved.x, 1);
  assert.equal(resolved.y, 2);
  assert.equal(resolved.z, 3);
  assert.equal(resolved.radius, 10);
  assert.equal(resolved.radiusSquared, 100);
  assert.equal(resolved.intensity, 2);
  assertNear(resolved.tintR, 0);
  assertNear(resolved.tintG, 128 / 255);
  assertNear(resolved.tintB, 1);

  // Omitted tint defaults to white -- a pure-brightness light.
  const [white] = raycaster.resolveLights([
    { x: 0, y: 0, radius: 5, intensity: 1 },
  ]);
  assertNear(white.tintR, 1);
  assertNear(white.tintG, 1);
  assertNear(white.tintB, 1);
}

function testLightSampling() {
  const raycaster = createPureRaycaster();

  // No lights, ambient 1 (the default): unchanged colour.
  assert.deepEqual(raycaster.sampleLightRgb(0, 0, 0, 1, []), {
    r: 1,
    g: 1,
    b: 1,
  });

  const [atOrigin] = raycaster.resolveLights([
    { x: 0, y: 0, z: 0, radius: 10, intensity: 1 },
  ]);

  const lit = raycaster.sampleLightRgb(0, 0, 0, 0.2, [atOrigin]);
  assertNear(lit.r, 1.2);
  assertNear(lit.g, 1.2);
  assertNear(lit.b, 1.2);

  // Exactly at the light's radius: fully attenuated, no contribution.
  const edge = raycaster.sampleLightRgb(10, 0, 0, 0.2, [atOrigin]);
  assertNear(edge.r, 0.2);

  // Beyond the radius: no contribution at all (no shadows/occlusion is a
  // separate concern -- this is purely the distance falloff).
  const outside = raycaster.sampleLightRgb(20, 0, 0, 0.2, [atOrigin]);
  assertNear(outside.r, 0.2);

  // A coloured light only contributes on its own channels.
  const [red] = raycaster.resolveLights([
    { x: 0, y: 0, z: 0, radius: 10, intensity: 1, tint: { r: 255, g: 0, b: 0 } },
  ]);
  const tinted = raycaster.sampleLightRgb(0, 0, 0, 0, [red]);
  assertNear(tinted.r, 1);
  assertNear(tinted.g, 0);
  assertNear(tinted.b, 0);
}

function testLightingRenderIntegration() {
  withFakeDom(() => {
    const game = createFakeGame();
    // Wide enough that the far wall doesn't fill the whole screen -- a room
    // just 1 cell deep leaves zero floor pixels visible (confirmed by
    // debugStats.planePixelsDrawn === 0 there), which would silently let
    // this test "pass" while never exercising plane lighting at all.
    const level = {
      width: 6,
      height: 3,
      map: ["111111", "100001", "111111"],
      cells: {
        0: {
          floorHeight: 0,
          ceilingHeight: 2.5,
          floor: { texture: "floorTexture", width: 4, height: 4 },
        },
        1: {
          floorHeight: 0,
          ceilingHeight: 2.5,
          wall: { texture: "wallTexture", width: 4, height: 4 },
        },
      },
    };
    const raycaster = new Raycaster(game, level, {
      width: 40,
      height: 30,
      cellSize: 4,
      cameraHeight: 1,
      debug: true,
    });
    const camera = { x: 6, y: 6, z: 1, angle: 0, pitch: 0 };

    raycaster.renderSnapshot(camera);
    assert.ok(raycaster.getDebugStats().planePixelsDrawn > 0);
    const baseline = Uint8ClampedArray.from(raycaster.imageData.data);

    // The documented no-op defaults must reproduce the same frame as
    // omitting lighting entirely.
    raycaster.renderSnapshot({ ...camera, lights: [], ambient: 1 });
    assert.deepEqual(
      Uint8ClampedArray.from(raycaster.imageData.data),
      baseline,
    );

    // A real light, placed over the floor partway down the corridor, must
    // actually reach the framebuffer (both wall and floor pixels).
    raycaster.renderSnapshot({
      ...camera,
      lights: [
        {
          x: 12,
          y: 6,
          z: 1,
          radius: 10,
          intensity: 2,
          tint: { r: 255, g: 255, b: 255 },
        },
      ],
    });
    assert.notDeepEqual(
      Uint8ClampedArray.from(raycaster.imageData.data),
      baseline,
    );
  });
}

function testFogBlend() {
  const raycaster = createPureRaycaster();

  // No fog config on the cell: no blend, regardless of distance.
  assert.equal(raycaster.getFogBlend(null, 100), null);

  const fog = { distance: 10, color: { r: 10, g: 20, b: 30 } };

  // At the camera (distance 0): no fog contribution yet.
  assert.equal(raycaster.getFogBlend(fog, 0), null);

  // Halfway to the configured distance: half-blended.
  assertNear(raycaster.getFogBlend(fog, 5).amount, 0.5);
  assert.deepEqual(raycaster.getFogBlend(fog, 5).color, fog.color);

  // At or beyond the configured distance: fully fogged, clamped to 1 (not
  // increasing further past the configured range).
  assertNear(raycaster.getFogBlend(fog, 10).amount, 1);
  assertNear(raycaster.getFogBlend(fog, 50).amount, 1);
}

function testFogRenderIntegration() {
  withFakeDom(() => {
    const game = createFakeGame();
    const camera = { x: 6, y: 6, z: 1, angle: 0, pitch: 0 };
    const wallCell = {
      floorHeight: 0,
      ceilingHeight: 2.5,
      wall: { texture: "wallTexture", width: 4, height: 4 },
    };
    // Wide enough that the far wall doesn't fill the entire screen -- the
    // floor (where the fog difference actually lives) must stay visible.
    const makeLevel = (openCellFog) => ({
      width: 6,
      height: 3,
      map: ["111111", "100001", "111111"],
      cells: {
        0: {
          floorHeight: 0,
          ceilingHeight: 2.5,
          floor: { texture: "floorTexture", width: 4, height: 4 },
          fog: openCellFog,
        },
        1: wallCell,
      },
    });
    const options = {
      width: 40,
      height: 30,
      cellSize: 4,
      cameraHeight: 1,
      debug: true,
    };

    const clearRaycaster = new Raycaster(game, makeLevel(false), options);
    clearRaycaster.renderSnapshot(camera);
    assert.ok(clearRaycaster.getDebugStats().planePixelsDrawn > 0);
    const clearFrame = Uint8ClampedArray.from(clearRaycaster.imageData.data);

    // Re-rendering the identical unfogged scene must reproduce the exact
    // same frame -- the no-op contract also holds for zones, not just for
    // camera.lights/camera.ambient.
    clearRaycaster.renderSnapshot(camera);
    assert.deepEqual(
      Uint8ClampedArray.from(clearRaycaster.imageData.data),
      clearFrame,
    );

    // Identical geometry and camera, except the cell the camera stands in
    // is now a fog zone: the frame must differ.
    const foggyRaycaster = new Raycaster(
      game,
      makeLevel({ distance: 6, color: { r: 40, g: 40, b: 90 } }),
      options,
    );
    foggyRaycaster.renderSnapshot(camera);
    assert.notDeepEqual(
      Uint8ClampedArray.from(foggyRaycaster.imageData.data),
      clearFrame,
    );
  });
}

function testWallSectionsRenderIntegration() {
  withFakeDom(() => {
    const game = createFakeGame();
    const camera = { x: 6, y: 6, z: 1, angle: 0, pitch: 0 };
    const wallMaterial = { texture: "wallTexture", width: 4, height: 4 };
    // Camera stands in cell 0 (x=1), facing down a corridor: a boundary
    // cell (x=2) that's either one ordinary full-height wall or a
    // "window" (two sections with a gap), then more open floor, then a
    // far wall (x=5) that only a ray passing through the gap can reach.
    const makeLevel = (windowed) => ({
      width: 6,
      height: 3,
      map: ["111111", "102001", "111111"],
      cells: {
        0: {
          floorHeight: 0,
          ceilingHeight: 4,
          floor: { texture: "floorTexture", width: 4, height: 4 },
        },
        1: { floorHeight: 0, ceilingHeight: 4, wall: wallMaterial },
        // Sill/lintel heights are deliberately kept off `camera.z` (1) --
        // renderPlane() treats a plane exactly at eye height as
        // degenerate (zero visual extent) and skips it, which would
        // silently no-op a cap and defeat the point of this test.
        2: windowed
          ? {
              floorHeight: 0,
              ceilingHeight: 4,
              sections: [
                { bottom: 0, top: 0.5, material: wallMaterial },
                { bottom: 3, top: 4, material: wallMaterial },
              ],
            }
          : { floorHeight: 0, ceilingHeight: 4, wall: wallMaterial },
      },
    });
    const options = {
      width: 40,
      height: 30,
      cellSize: 4,
      cameraHeight: 1,
      debug: true,
    };

    const solidRaycaster = new Raycaster(game, makeLevel(false), options);
    solidRaycaster.renderSnapshot(camera);
    const solidStats = solidRaycaster.getDebugStats();
    const solidFrame = Uint8ClampedArray.from(solidRaycaster.imageData.data);

    const windowedRaycaster = new Raycaster(game, makeLevel(true), options);
    windowedRaycaster.renderSnapshot(camera);
    const windowedStats = windowedRaycaster.getDebugStats();
    const windowedFrame = Uint8ClampedArray.from(
      windowedRaycaster.imageData.data,
    );

    // A solid boundary closes the column immediately: nothing behind it
    // (the far wall at x=5) is ever reached or drawn.
    assert.equal(solidStats.wallSegments, 40); // one section, one per column
    // The windowed boundary draws its own two sections, *and* leaves the
    // gap open long enough for the ray to reach and draw the far wall --
    // strictly more wall-drawing work than the solid case, in exactly the
    // way "a gap reveals what's behind it" predicts. (Not asserting on
    // wallPixels: two short sections can legitimately span fewer total
    // rows than one full-height wall, so that count isn't a reliable
    // proxy here -- wallSegments and the cap-driven plane count are.)
    assert.ok(windowedStats.wallSegments > solidStats.wallSegments);
    assert.ok(windowedStats.planePixelsDrawn > solidStats.planePixelsDrawn);

    // The rendered frames must actually differ -- the gap isn't just
    // counted internally, it's visible.
    assert.notDeepEqual(windowedFrame, solidFrame);
  });
}

function testSectionCapsRenderIntegration() {
  withFakeDom(() => {
    const game = createFakeGame();
    const camera = { x: 6, y: 6, z: 1.5, angle: 0, pitch: 0 };
    const wallMaterial = { texture: "wallTexture", width: 4, height: 4 };
    // The window is the *last* cell the ray can reach (map ends right
    // after it), so nothing is ever visible "through" the gap -- any
    // extra plane drawing between the solid and windowed variants can
    // only come from the sill's top / lintel's underside cap faces
    // themselves, isolating exactly the bug being fixed here.
    const makeLevel = (windowed) => ({
      width: 3,
      height: 3,
      map: ["111", "102", "111"],
      cells: {
        0: { floorHeight: 0, ceilingHeight: 4 },
        2: windowed
          ? {
              floorHeight: 0,
              ceilingHeight: 4,
              sections: [
                { bottom: 0, top: 0.5, material: wallMaterial },
                { bottom: 3, top: 4, material: wallMaterial },
              ],
            }
          : { floorHeight: 0, ceilingHeight: 4, wall: wallMaterial },
      },
    });
    const options = {
      width: 40,
      height: 30,
      cellSize: 4,
      cameraHeight: 1.5,
      debug: true,
    };

    const solidRaycaster = new Raycaster(game, makeLevel(false), options);
    solidRaycaster.renderSnapshot(camera);
    const solidStats = solidRaycaster.getDebugStats();

    const windowedRaycaster = new Raycaster(game, makeLevel(true), options);
    windowedRaycaster.renderSnapshot(camera);
    const windowedStats = windowedRaycaster.getDebugStats();

    // The solid wall has no caps to draw at all.
    assert.equal(solidStats.planePixelsDrawn, 0);
    // The windowed boundary must draw its sill's top and lintel's
    // underside, with nothing else in the scene able to account for it.
    assert.ok(windowedStats.planePixelsDrawn > 0);
  });
}

function testSkyConstructorLoading() {
  withFakeDom(() => {
    const game = createFakeGame();
    const level = {
      width: 3,
      height: 3,
      map: ["111", "101", "111"],
      cells: {
        0: { floorHeight: 0, ceilingHeight: 4 },
        1: { floorHeight: 0, ceilingHeight: 4, wall: { texture: "wallTexture", width: 4, height: 4 } },
      },
    };
    const options = { width: 20, height: 20, cellSize: 4, cameraHeight: 1 };

    // No level.sky: the default flat-colour background path, no sky loaded.
    const noSky = new Raycaster(game, level, options);
    assert.equal(noSky.sky, null);

    // level.sky loads through the same surface pipeline as wall/floor/
    // ceiling materials -- same caching, same decode path.
    const withSky = new Raycaster(
      game,
      { ...level, sky: { texture: "skyTexture" } },
      options,
    );
    assert.ok(withSky.sky);
    assert.equal(withSky.sky.textureKey, "skyTexture");
    assert.ok(withSky.sky.widthPixels > 0);
  });
}

function testFillFlatSky() {
  const raycaster = createPureRaycaster({ width: 4, height: 6 });
  const pixels = new Uint8ClampedArray(4 * 6 * 4);
  const sky = Raycaster.DEFAULT_FOG_COLOR;

  raycaster.fillFlatSky(pixels, 3);

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 4; x++) {
      const i = (y * 4 + x) * 4;
      assert.equal(pixels[i], sky.r);
      assert.equal(pixels[i + 1], sky.g);
      assert.equal(pixels[i + 2], sky.b);
      assert.equal(pixels[i + 3], 255);
    }
  }
  // Untouched below skyRows -- left for floor/ceiling rendering (or, if
  // neither is present, to stay transparent) rather than assumed sky.
  for (let y = 3; y < 6; y++) {
    for (let x = 0; x < 4; x++) {
      const i = (y * 4 + x) * 4;
      assert.equal(pixels[i + 3], 0);
    }
  }

  // skyRows can reach the full screen height -- this is exactly what
  // fixes the pitch-cutoff bug: the fill is never capped at a fixed
  // half of the screen, only at whatever the caller (renderSnapshot(),
  // driven by the current renderHorizon) asks for.
  const full = new Uint8ClampedArray(4 * 6 * 4);
  raycaster.fillFlatSky(full, 6);
  for (let i = 3; i < full.length; i += 4) assert.equal(full[i], 255);
}

function testRenderSkyFollowsAngleNotPosition() {
  // A 4-pixel-wide fake sky texture with a distinct red channel per
  // column, so sampling a different textureX is directly observable.
  const sky = {
    widthPixels: 4,
    heightPixels: 2,
    pixels: (() => {
      const data = new Uint8ClampedArray(4 * 2 * 4);
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 2; y++) {
          const i = (y * 4 + x) * 4;
          data[i] = x * 85; // 0, 85, 170, 255
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
        }
      }
      return data;
    })(),
  };
  const raycaster = createPureRaycaster({
    width: 4,
    height: 4,
    sky,
    skyRowScratch: new Int32Array(4),
    // Every column looks exactly along camera.angle (no per-column
    // spread), isolating the mapping down to angle alone.
    columnGeometry: [0, 1, 2, 3].map(() => ({ angleOffset: 0 })),
  });

  const sampleRedAt = (camera) => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    raycaster.renderSky(pixels, camera, 4);
    return pixels[0]; // row 0, column 0, red channel
  };

  const facingRight = sampleRedAt({ x: 0, y: 0, angle: 0 });
  // Moving (x/y change) with the same angle must not change the sky at
  // all -- this is the "player movement does not affect it" requirement.
  const movedSamePosition = sampleRedAt({ x: 500, y: -500, angle: 0 });
  assert.equal(movedSamePosition, facingRight);

  // Turning (angle change) with the same position must change it --
  // "horizontal texture position follows the camera angle."
  const turned = sampleRedAt({ x: 0, y: 0, angle: Math.PI / 2 });
  assert.notEqual(turned, facingRight);
  assert.equal(turned, 1 * 85); // quarter turn -> texture column 1 of 4
}

function testSkyTracksPitchEndToEnd() {
  withFakeDom(() => {
    const game = createFakeGame();
    // No floor/ceiling surfaces and maxDistance short enough that no
    // wall is ever reached -- the only thing that can appear anywhere
    // on screen is the sky/background fill, isolating the pitch-cutoff
    // fix from any interaction with floor/wall rendering.
    const level = {
      width: 3,
      height: 3,
      map: ["111", "101", "111"],
      cells: {
        0: { floorHeight: -50, ceilingHeight: 50 },
        1: { floorHeight: -50, ceilingHeight: 50, wall: { texture: "wallTexture", width: 4, height: 4 } },
      },
    };
    // maxDistance is a *raycaster* option, not level data -- kept short
    // enough that the boundary wall (2 world units away) is never
    // reached, so it can't dominate/mask the background being tested.
    const raycaster = new Raycaster(game, level, {
      width: 10,
      height: 40,
      cellSize: 4,
      cameraHeight: 1,
      maxDistance: 0.1,
    });
    const camera = { x: 6, y: 6, angle: 0 };
    // Row well past the old fixed height/2 (=20) split that used to cap
    // the background regardless of pitch.
    const probeRow = 35;
    const sampleAlpha = (pitch) => {
      raycaster.renderSnapshot({ ...camera, pitch });
      const index = (probeRow * raycaster.width + 5) * 4 + 3;
      return raycaster.imageData.data[index];
    };

    // At zero pitch, row 35 is well below the horizon and untouched by
    // sky (and there's no floor surface to draw there either).
    assert.equal(sampleAlpha(0), 0);
    // Enough pitch pushes renderHorizon (and therefore skyRows) past
    // row 35, which must now be sky -- this is the reported bug: the
    // old static half-screen background never reached this far no
    // matter how far the camera pitched.
    assert.equal(sampleAlpha(100), 255);
  });
}

function testFisheyeCorrection() {
  const raycaster = createPureRaycaster();
  const distance = 12;
  const angle = Math.PI / 6;
  const playerAngle = 0;
  assertNear(
    raycaster.getCorrectedDistance(distance, angle, playerAngle),
    12 * Math.cos(angle),
    1e-12,
  );
  assert.equal(
    raycaster.getCorrectedDistance(distance, Math.PI / 2, playerAngle),
    0.0001,
  );
}

function testDdaSegments() {
  const raycaster = createPureRaycaster({
    level: {
      width: 5,
      height: 3,
      map: ["11111", "10001", "11111"],
    },
    cells: {
      0: { wall: null, sections: [] },
      1: {
        wall: { textureKey: "wall" },
        sections: [{ bottom: 0, top: 1, material: { textureKey: "wall" } }],
      },
    },
  });
  raycaster.map = raycaster.normaliseMap(raycaster.level.map);

  const segments = raycaster.traceRay(6, 6, 0, 1, 0);
  assert.equal(segments.length, 4);
  assert.deepEqual(
    segments.map(({ mapX, mapY }) => [mapX, mapY]),
    [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ],
  );
  assert.deepEqual(
    segments.map(({ entryDistance, exitDistance }) => [
      entryDistance,
      exitDistance,
    ]),
    [
      [0, 2],
      [2, 6],
      [6, 10],
      [10, 14],
    ],
  );
  assert.equal(segments[0].entrySide, null);
  assert.equal(segments[1].entrySide, 0);
  assert.equal(segments[2].entrySide, 0);
  assert.equal(segments[3].entrySide, 0);
  assertNear(segments[3].entryHitX, 16);
  assertNear(raycaster.castRay(6, 6, 0).distance, 10);
}

function testPlaneDistance() {
  const raycaster = createPureRaycaster();
  const distance = raycaster.getPlaneDistanceAtScreenY(0, 120, 1);
  const expected = (4 * raycaster.focalLength) / 30;
  assertNear(distance, expected, 1e-12);
  assert.equal(raycaster.getPlaneDistanceAtScreenY(0, 90, 1), null);

  const projected = raycaster.getPlaneScreenY(0, distance, 1);
  assertNear(projected, 120, 1e-12);
}

function testIntervalClipping() {
  const raycaster = createPureRaycaster();
  const intervals = new Float64Array(16);
  intervals[0] = 0;
  intervals[1] = 179;

  let count = 1;
  count = raycaster.subtractInterval(intervals, 50, 100, count);
  assert.equal(count, 2);
  assert.deepEqual(
    Array.from(intervals.slice(0, count * 2)),
    [0, 49, 101, 179],
  );

  count = raycaster.subtractInterval(intervals, 20, 30, count);
  count = raycaster.subtractInterval(intervals, 140, 160, count);
  assert.equal(count, 4);
  assert.deepEqual(
    Array.from(intervals.slice(0, count * 2)),
    [0, 19, 31, 49, 101, 139, 161, 179],
  );

  count = raycaster.subtractInterval(intervals, 0, 179, count);
  assert.equal(count, 0);
}

function testSurfaceResolution() {
  const raycaster = createPureRaycaster({
    level: {
      materials: {
        brick: { texture: "brickTexture", width: 2, height: 1.5 },
      },
    },
  });

  assert.deepEqual(raycaster.resolveSurface("brick"), {
    texture: "brickTexture",
    width: 2,
    height: 1.5,
  });
  assert.deepEqual(raycaster.resolveSurface({ material: "brick", height: 3 }), {
    texture: "brickTexture",
    width: 2,
    height: 3,
    material: "brick",
  });
  assert.equal(raycaster.resolveSurface("missing"), null);
}

function testCameraSnapshot() {
  const raycaster = createPureRaycaster({ fov: Math.PI / 3 });
  assert.equal(typeof raycaster.render, "function");
  assert.equal(typeof raycaster.renderSnapshot, "function");
  assert.deepEqual(raycaster.createCameraSnapshot({ x: 6, y: 10, angle: 0 }), {
    x: 6,
    y: 10,
    z: 4,
    angle: 0,
    pitch: 0,
    fov: Math.PI / 3,
  });
  assert.deepEqual(
    raycaster.createCameraSnapshot({
      x: 1,
      y: 2,
      z: 3,
      angle: 0.5,
      pitch: -4,
      fov: 1,
    }),
    { x: 1, y: 2, z: 3, angle: 0.5, pitch: -4, fov: 1 },
  );
}

function testLevelNormalisation() {
  const raycaster = createPureRaycaster({
    level: {
      defaultFloorHeight: 2,
      defaultCeilingHeight: 9,
    },
  });

  assert.deepEqual(raycaster.normaliseMap(["102", ["3", 4, 5]]), [
    ["1", "0", "2"],
    ["3", "4", "5"],
  ]);
  assert.deepEqual(raycaster.normaliseCellDefinition(), {
    floorHeight: 2,
    ceilingHeight: 9,
    wall: null,
    sections: [],
    floor: null,
    ceiling: null,
    blocking: false,
    fog: null,
  });
  assert.deepEqual(
    raycaster.normaliseCellDefinition({ floorHeight: 1, wall: "brick" }),
    {
      floorHeight: 1,
      ceilingHeight: 9,
      wall: "brick",
      // A plain `wall` is sugar for one section spanning the whole cell.
      sections: [{ bottom: 1, top: 9, material: "brick" }],
      floor: null,
      ceiling: null,
      // A wall blocks by default when `blocking` is not set explicitly.
      blocking: true,
      fog: null,
    },
  );
  assert.deepEqual(
    raycaster.normaliseCellDefinition({ wall: "brick", blocking: false }),
    {
      floorHeight: 2,
      ceilingHeight: 9,
      wall: "brick",
      sections: [{ bottom: 2, top: 9, material: "brick" }],
      floor: null,
      ceiling: null,
      // Explicit override: a walled cell that does not block, i.e. a step.
      blocking: false,
      fog: null,
    },
  );

  // Explicit `sections` describe independent vertical bands (windows,
  // arches, railings, overhangs) on the same boundary; `sections` wins
  // over `wall` if both are given, and each section's own bottom/top
  // default from the cell's floor/ceiling height.
  assert.deepEqual(
    raycaster.normaliseCellDefinition({
      wall: "ignored-when-sections-given",
      sections: [
        { bottom: 0, top: 1, material: "brick" },
        { top: 2.5, material: "brick" }, // bottom defaults to floorHeight
      ],
    }).sections,
    [
      { bottom: 0, top: 1, material: "brick" },
      { bottom: 2, top: 2.5, material: "brick" },
    ],
  );
  // A cell with no wall and no sections has an empty, non-blocking
  // boundary -- an open cell.
  assert.deepEqual(raycaster.normaliseCellDefinition({ sections: [] }), {
    floorHeight: 2,
    ceilingHeight: 9,
    wall: null,
    sections: [],
    floor: null,
    ceiling: null,
    blocking: false,
    fog: null,
  });

  // `fog: true` is shorthand for the built-in defaults.
  assert.deepEqual(raycaster.normaliseCellDefinition({ fog: true }).fog, {
    distance: 20,
    color: Raycaster.DEFAULT_FOG_COLOR,
  });
  // Explicit per-cell overrides.
  assert.deepEqual(
    raycaster.normaliseCellDefinition({
      fog: { distance: 5, color: { r: 1, g: 2, b: 3 } },
    }).fog,
    { distance: 5, color: { r: 1, g: 2, b: 3 } },
  );

  // Level-wide fog defaults, used when a cell only opts in with `fog: true`.
  const withLevelDefaults = createPureRaycaster({
    level: {
      defaultFloorHeight: 0,
      defaultCeilingHeight: 3,
      defaultFogDistance: 12,
      defaultFogColor: { r: 9, g: 9, b: 9 },
    },
  });
  assert.deepEqual(withLevelDefaults.normaliseCellDefinition({ fog: true }).fog, {
    distance: 12,
    color: { r: 9, g: 9, b: 9 },
  });
}

function testColumnDepth() {
  const raycaster = createPureRaycaster({
    width: 4,
    columnDepth: new Float32Array([3, 7, 11, 15]),
    pixelDepth: new Float32Array(4 * 180),
  });
  raycaster.resetColumnDepth();
  assert.deepEqual(Array.from(raycaster.columnDepth), [
    Infinity,
    Infinity,
    Infinity,
    Infinity,
  ]);
  raycaster.columnDepth[2] = 11;
  assert.equal(raycaster.getColumnDepth(2), 11);
}

function testDynamicCameraProjection() {
  const raycaster = createPureRaycaster({
    fov: Math.PI / 3,
    columnGeometry: [],
  });
  raycaster.updateProjection({
    x: 0,
    y: 0,
    z: 6,
    angle: 0,
    pitch: 5,
    fov: Math.PI / 2,
  });

  assert.equal(raycaster.renderCameraHeight, 6);
  assert.equal(raycaster.renderHorizon, 95);
  assert.equal(raycaster.fov, Math.PI / 2);
  assert.equal(raycaster.columnGeometry.length, raycaster.width);
  assert.equal(raycaster.planeRowFactors.length, raycaster.height);
  assertNear(raycaster.projectWorldZ(6, 10), 95);
}

function testBillboardProjection() {
  const raycaster = createPureRaycaster();
  raycaster.renderCameraHeight = 4;
  raycaster.renderHorizon = 90;
  const camera = { x: 0, y: 0, angle: 0 };
  const sprite = { x: 10, y: 0, z: 0, width: 2, height: 4 };
  const cameraSpace = raycaster.getSpriteCameraSpace(camera, sprite);
  const projection = raycaster.projectBillboard(camera, sprite, cameraSpace);

  assertNear(projection.centerX, 160);
  assertNear(projection.projectedWidth, raycaster.focalLength / 5);
  assertNear(projection.bottom, 90 + raycaster.focalLength * 0.4);
  assert.ok(projection.top < projection.bottom);

  const scaled = raycaster.projectBillboard(
    camera,
    { x: 10, y: 0, z: 0, width: 2, height: 4, scale: 0.5 },
    cameraSpace,
  );
  assertNear(scaled.centerX, projection.centerX);
  assertNear(scaled.projectedWidth, projection.projectedWidth / 2);
  assertNear(scaled.projectedHeight, projection.projectedHeight / 2);
}

function testBillboardRotationDiagnostic() {
  const raycaster = createPureRaycaster();
  raycaster.renderCameraHeight = 4;
  raycaster.renderHorizon = 90;
  const sprite = { x: 10, y: 0, z: 0, width: 2, height: 4 };
  const angles = [0, Math.PI / 8, Math.PI / 4, (3 * Math.PI) / 8];
  const diagnostics = angles.map((angle) =>
    raycaster.getSpriteProjectionDiagnostic({ x: 0, y: 0, angle }, sprite),
  );

  console.table(diagnostics);
  assertNear(diagnostics[0].lateral, 0);
  assertNear(diagnostics[0].depth, 10);
  assertNear(diagnostics[0].projectedScreenX, 160);
  assert.ok(diagnostics.every((entry) => entry.depth > 0));
  assert.ok(
    diagnostics.every((entry) => Number.isFinite(entry.projectedScreenX)),
  );
}

function createSegmentFixture(map, cells, maxDistance = 100) {
  const rows = map.map((row) => (typeof row === "string" ? row : row.join("")));
  const raycaster = createPureRaycaster({
    level: {
      width: rows[0].length,
      height: rows.length,
      map: rows,
    },
    cells,
    maxDistance,
  });
  raycaster.map = raycaster.normaliseMap(rows);
  return raycaster;
}

function testVariableHeightFixtures() {
  const cells = {
    0: { floorHeight: 0, ceilingHeight: 2.5, wall: null },
    1: { floorHeight: 0, ceilingHeight: 8, wall: { textureKey: "wall8" } },
    2: { floorHeight: 0, ceilingHeight: 16, wall: { textureKey: "wall16" } },
    3: { floorHeight: 1, ceilingHeight: 3, wall: { textureKey: "short" } },
  };

  const raycaster = createSegmentFixture(["111111", "100023", "111111"], cells);
  const segments = raycaster.traceRay(6, 6, 0, 1, 0);

  assert.deepEqual(
    segments.map(({ mapX, mapY }) => [mapX, mapY]),
    [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
    ],
  );
  assert.deepEqual(
    segments.map(({ cell }) => [cell.floorHeight, cell.ceilingHeight]),
    [
      [0, 2.5],
      [0, 2.5],
      [0, 2.5],
      [0, 16],
      [1, 3],
    ],
  );
  assert.equal(segments[2].entrySide, 0);
  assert.equal(segments[3].entrySide, 0);
  assertNear(segments[3].entryDistance, 10);
}

function testAdjacentHeightFixtures() {
  const cells = {
    0: { floorHeight: 0, ceilingHeight: 4, wall: null },
    1: { floorHeight: 2, ceilingHeight: 10, wall: { textureKey: "step" } },
    2: { floorHeight: -1, ceilingHeight: 6, wall: { textureKey: "lower" } },
  };
  const raycaster = createSegmentFixture(["11111", "10221", "11111"], cells);
  const segments = raycaster.traceRay(6, 6, 0, 1, 0);

  assert.deepEqual(
    segments
      .slice(0, 4)
      .map(({ cell }) => [cell.floorHeight, cell.ceilingHeight]),
    [
      [0, 4],
      [-1, 6],
      [-1, 6],
      [2, 10],
    ],
  );
  assert.ok(segments[1].entryDistance < segments[2].entryDistance);
}

function testOpenCeilingFixture() {
  const raycaster = createSegmentFixture(["1111", "1001", "1111"], {
    0: { floorHeight: 0, ceilingHeight: 2.5, wall: null, ceiling: null },
    1: {
      floorHeight: 0,
      ceilingHeight: 6,
      wall: { textureKey: "wall" },
      ceiling: null,
    },
  });
  const segment = raycaster.traceRay(6, 6, 0, 1, 0)[0];
  assert.equal(segment.cell.ceiling, null);
  assert.equal(segment.cell.ceilingHeight, 2.5);
}

function testMultiCellCorridorFixture() {
  const raycaster = createSegmentFixture(["11111111", "10000001", "11111111"], {
    0: { floorHeight: 0, ceilingHeight: 4, wall: null },
    1: { floorHeight: 0, ceilingHeight: 8, wall: { textureKey: "wall" } },
  });
  const segments = raycaster.traceRay(6, 6, 0, 1, 0);
  assert.equal(segments.length, 7);
  assert.ok(
    segments.every((segment, index) => {
      return (
        index === 0 || segment.entryDistance >= segments[index - 1].exitDistance
      );
    }),
  );
  assert.equal(segments[0].entrySide, null);
  assert.ok(segments.slice(1).every((segment) => segment.entrySide === 0));
}

function testStepCollision() {
  const cells = {
    1: { floorHeight: 0, ceilingHeight: 8, wall: { textureKey: "wall" }, blocking: true },
    2: { floorHeight: 0, ceilingHeight: 2.5, wall: null, blocking: false },
    // A low wall marked non-blocking: a step. Standing on it rests on its
    // top (ceilingHeight), not its base (floorHeight).
    3: {
      floorHeight: 0,
      ceilingHeight: 0.5,
      wall: { textureKey: "step" },
      sections: [{ bottom: 0, top: 0.5, material: { textureKey: "step" } }],
      blocking: false,
    },
  };
  const raycaster = createSegmentFixture(["111", "132", "111"], cells);

  // Full-height wall still blocks.
  assert.equal(raycaster.isWall(0, 1), true);
  assert.equal(raycaster.isWallWorld(2, 6), true);

  // A wall face marked `blocking: false` no longer blocks movement...
  assert.equal(raycaster.isWall(1, 1), false);
  assert.equal(raycaster.isWallWorld(6, 6), false);
  // ...and standing there rests on top of the block, not its base.
  assert.equal(raycaster.getStandingHeight(1, 1), 0.5);
  assert.equal(raycaster.getStandingHeightWorld(6, 6), 0.5);
  assertNear(raycaster.getEyeHeightWorld(6, 6), 0.5 + raycaster.cameraHeight);

  // An open cell (no wall at all) still stands on its floor height.
  assert.equal(raycaster.isWall(2, 1), false);
  assert.equal(raycaster.getStandingHeight(2, 1), 0);
  assertNear(raycaster.getEyeHeightWorld(10, 6), raycaster.cameraHeight);
}

function createVisibilityFixture() {
  const wallMaterial = { textureKey: "wall" };
  // index: 0='1' boundary, 1='0' open, 2='1' interior full wall (same
  // definition as the boundary, just placed away from the map edge),
  // 3='0' open, 4='2' window, 5='0' open, 6='1' boundary. This keeps the
  // full-wall crossing (mapX 1->3) and the window crossing (mapX 3->5)
  // on disjoint stretches of the corridor so each test below exercises
  // exactly one of them.
  return createSegmentFixture(["1111111", "1010201", "1111111"], {
    0: { floorHeight: 0, ceilingHeight: 4 },
    1: {
      floorHeight: 0,
      ceilingHeight: 4,
      sections: [{ bottom: 0, top: 4, material: wallMaterial }],
    },
    // A window: solid sill/lintel with a gap from height 1 to 3.
    2: {
      floorHeight: 0,
      ceilingHeight: 4,
      sections: [
        { bottom: 0, top: 1, material: wallMaterial },
        { bottom: 3, top: 4, material: wallMaterial },
      ],
    },
  });
}

function testCheckVisibility() {
  const raycaster = createVisibilityFixture();

  // Clear line of sight through the window's open gap (mapX 3 -> 5).
  const throughGap = raycaster.checkVisibility(
    { x: 14, y: 6, z: 2 },
    { x: 22, y: 6, z: 2 },
  );
  assert.equal(throughGap.visible, true);
  assertNear(throughGap.distance, 8);
  assert.equal(throughGap.hitDistance, null);
  assert.equal(throughGap.cell, null);

  // Same straight line, but at a height inside the window's solid sill:
  // the open section elsewhere on the same boundary must not matter --
  // only whether *this* height is covered by a section.
  const throughSill = raycaster.checkVisibility(
    { x: 14, y: 6, z: 0.5 },
    { x: 22, y: 6, z: 0.5 },
  );
  assert.equal(throughSill.visible, false);
  assertNear(throughSill.distance, 8);
  assert.ok(throughSill.hitDistance > 0 && throughSill.hitDistance < 8);
  assert.equal(throughSill.mapX, 4);
  assert.equal(throughSill.mapY, 1);
  assert.ok(throughSill.cell.sections.length > 0);

  // An interior full-height wall (mapX 1 -> 3) blocks regardless of
  // height, well before either endpoint reaches the window.
  const throughWall = raycaster.checkVisibility(
    { x: 6, y: 6, z: 2 },
    { x: 14, y: 6, z: 2 },
  );
  assert.equal(throughWall.visible, false);
  assert.equal(throughWall.mapX, 2);

  // Same XY position, different Z: no grid boundary can block a purely
  // vertical line of sight.
  const vertical = raycaster.checkVisibility(
    { x: 6, y: 6, z: 0 },
    { x: 6, y: 6, z: 5 },
  );
  assert.equal(vertical.visible, true);
  assertNear(vertical.distance, 5);

  // z defaults to 0 when omitted, matching sprites/lights -- height 0 is
  // within the window's sill.
  const defaultZ = raycaster.checkVisibility(
    { x: 14, y: 6 },
    { x: 22, y: 6 },
  );
  assert.equal(defaultZ.visible, false);
}

function testSetCellBlocking() {
  const raycaster = createSegmentFixture(["111", "101", "111"], {
    0: { floorHeight: 0, ceilingHeight: 4 },
    1: {
      floorHeight: 0,
      ceilingHeight: 4,
      sections: [{ bottom: 0, top: 4, material: {} }],
      blocking: true,
    },
  });

  assert.equal(raycaster.isWall(0, 1), true);

  const opened = raycaster.setCellBlocking(1, false);
  assert.ok(opened);
  assert.equal(raycaster.isWall(0, 1), false);

  raycaster.setCellBlocking(1, true);
  assert.equal(raycaster.isWall(0, 1), true);

  // Unknown id: warns and returns null rather than throwing.
  assert.equal(raycaster.setCellBlocking("missing", false), null);
}

function testSetCellSections() {
  withFakeDom(() => {
    const raycaster = createPureRaycaster({
      game: createFakeGame(),
      materialCache: Object.create(null),
      materialCacheHits: 0,
      materialCacheMisses: 0,
      level: { materials: {} },
      cells: {
        1: { floorHeight: 0, ceilingHeight: 4, sections: [], blocking: true },
      },
    });

    const wall = { texture: "wallTexture", width: 4, height: 4 };
    const updated = raycaster.setCellSections(1, [
      { bottom: 1, material: wall }, // top omitted -> defaults to ceilingHeight
      { top: 3, material: wall }, // bottom omitted -> defaults to floorHeight
    ]);

    assert.ok(updated);
    // Sorted by bottom (0 before 1), and heights defaulted from the
    // cell's own floorHeight/ceilingHeight -- same rules
    // normaliseCellDefinition() applies at level-load time.
    assert.deepEqual(
      updated.sections.map((s) => [s.bottom, s.top]),
      [
        [0, 3],
        [1, 4],
      ],
    );
    // `material` was resolved through the real loadSurface() pipeline,
    // not left as the raw {texture, width, height} definition.
    assert.equal(updated.sections[0].material.textureKey, "wallTexture");
    assert.ok(updated.sections[0].material.widthPixels > 0);

    // Unknown id: warns and returns null rather than throwing.
    assert.equal(raycaster.setCellSections("missing", []), null);
  });
}

function testDoorRuntimeMutation() {
  withFakeDom(() => {
    const game = createFakeGame();
    const wallMaterial = { texture: "wallTexture", width: 4, height: 4 };
    // Cell "2" is the door: a normal full-height wall until it's opened
    // at runtime via setCellSections()/setCellBlocking().
    const level = {
      width: 6,
      height: 3,
      map: ["111111", "100201", "111111"],
      cells: {
        0: {
          floorHeight: 0,
          ceilingHeight: 4,
          floor: { texture: "floorTexture", width: 4, height: 4 },
        },
        1: { floorHeight: 0, ceilingHeight: 4, wall: wallMaterial },
        2: {
          floorHeight: 0,
          ceilingHeight: 4,
          wall: wallMaterial,
          blocking: true,
        },
      },
    };
    const raycaster = new Raycaster(game, level, {
      width: 40,
      height: 30,
      cellSize: 4,
      cameraHeight: 1,
    });
    const camera = { x: 6, y: 6, z: 1, angle: 0, pitch: 0 };
    const sightline = [
      { x: 6, y: 6, z: 2 },
      { x: 18, y: 6, z: 2 },
    ];

    // Closed: blocks movement and sight, renders as a solid wall.
    assert.equal(raycaster.isWallWorld(14, 6), true);
    assert.equal(raycaster.checkVisibility(...sightline).visible, false);
    raycaster.renderSnapshot(camera);
    const closedFrame = Uint8ClampedArray.from(raycaster.imageData.data);

    // Open the door at runtime -- same instance, no re-render or "apply"
    // step beyond the setters themselves.
    raycaster.setCellSections("2", []);
    raycaster.setCellBlocking("2", false);

    assert.equal(raycaster.isWallWorld(14, 6), false);
    assert.equal(raycaster.checkVisibility(...sightline).visible, true);
    raycaster.renderSnapshot(camera);
    const openFrame = Uint8ClampedArray.from(raycaster.imageData.data);

    assert.notDeepEqual(openFrame, closedFrame);
  });
}

const tests = [
  ["world-Z projection", testWorldProjection],
  ["get forward vector", testGetForwardVector],
  ["get camera forward vector matches rendered view", testGetCameraForwardVector],
  ["constructor-derived projection", testConstructorDerivedProjection],
  ["light resolution", testLightResolution],
  ["light sampling", testLightSampling],
  ["lighting render integration", testLightingRenderIntegration],
  ["fog blend", testFogBlend],
  ["fog render integration", testFogRenderIntegration],
  ["wall sections render integration", testWallSectionsRenderIntegration],
  ["section caps render integration", testSectionCapsRenderIntegration],
  ["sky constructor loading", testSkyConstructorLoading],
  ["fill flat sky", testFillFlatSky],
  ["render sky follows angle not position", testRenderSkyFollowsAngleNotPosition],
  ["sky tracks pitch end to end", testSkyTracksPitchEndToEnd],
  ["fisheye correction", testFisheyeCorrection],
  ["DDA segments", testDdaSegments],
  ["plane distance", testPlaneDistance],
  ["interval clipping", testIntervalClipping],
  ["surface resolution", testSurfaceResolution],
  ["camera snapshot", testCameraSnapshot],
  ["level normalisation", testLevelNormalisation],
  ["column depth", testColumnDepth],
  ["dynamic camera projection", testDynamicCameraProjection],
  ["billboard projection", testBillboardProjection],
  ["billboard rotation diagnostic", testBillboardRotationDiagnostic],
  ["variable-height fixtures", testVariableHeightFixtures],
  ["adjacent-height fixtures", testAdjacentHeightFixtures],
  ["open-ceiling fixture", testOpenCeilingFixture],
  ["multi-cell corridor fixture", testMultiCellCorridorFixture],
  ["step collision", testStepCollision],
  ["check visibility", testCheckVisibility],
  ["set cell blocking", testSetCellBlocking],
  ["set cell sections", testSetCellSections],
  ["door runtime mutation", testDoorRuntimeMutation],
];

for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}

console.log(`\n${tests.length} raycaster geometry tests passed.`);
