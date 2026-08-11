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
      0: { wall: null },
      1: { wall: { textureKey: "wall" } },
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
      floor: null,
      ceiling: null,
      // Explicit override: a walled cell that does not block, i.e. a step.
      blocking: false,
      fog: null,
    },
  );

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

const tests = [
  ["world-Z projection", testWorldProjection],
  ["constructor-derived projection", testConstructorDerivedProjection],
  ["light resolution", testLightResolution],
  ["light sampling", testLightSampling],
  ["lighting render integration", testLightingRenderIntegration],
  ["fog blend", testFogBlend],
  ["fog render integration", testFogRenderIntegration],
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
];

for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}

console.log(`\n${tests.length} raycaster geometry tests passed.`);
