// WebGLRenderer contract/regression coverage, run under Node -- there is no
// real GPU/WebGL context available here (see Docs/wasm-renderer-readme.md's
// benchmark notes for the same limitation on the WASM side), so this file
// covers what's actually possible without one:
//
//   1. buildGeometryBatches() -- the pure, gl-free mesh-building step -- is
//      fully unit-testable: given a level, it should produce exactly the
//      vertex data the WebGL implementation plan says it should.
//   2. WebGLRenderer's graceful-degradation contract (mirrors
//      tests/wasm-renderer-contract.test.mjs): when WebGL2 isn't available,
//      it must never throw, and must delegate every render to `fallback`.
//   3. WebGLRenderer's "ready" lifecycle (construct -> render -> mutate a
//      cell -> destroy) against a mock WebGL2 context that records calls
//      instead of touching a real GPU -- enough to catch a wrong argument
//      count, a missing uniform, or a crash, even though it can't tell us
//      whether a single pixel is the right colour.
//   4. Renderer selection through the real `new Raycaster(...)` API with
//      `renderer: "webgl"`, both when WebGL2 is available and when it
//      isn't.
//
// Actual pixel-level correctness (textures, lighting, fog, sky, sprite
// placement) needs a real browser -- see this repo's WebGL implementation
// plan's "Verification" section for the manual npm start checklist.
import assert from "node:assert/strict";
import { Raycaster } from "../scripts/system/Raycaster.js";
import { SoftwareRenderer } from "../scripts/system/SoftwareRenderer.js";
import { WebGLRenderer, buildGeometryBatches } from "../scripts/system/WebGLRenderer.js";

function makeMaterial(overrides = {}) {
  return {
    width: 4,
    height: 4,
    widthPixels: 8,
    heightPixels: 8,
    pixels: new Uint8Array(8 * 8 * 4),
    ...overrides,
  };
}

// A 3x3 ring: eight full-height wall cells ("1") around one open cell ("0")
// with a floor and ceiling that deliberately share one material object, so
// batching-by-material-identity is exercised (they must land in the same
// batch).
function buildRingLevel() {
  const wall = makeMaterial();
  const floorAndCeiling = makeMaterial();
  const level = { width: 3, height: 3 };
  const map = [
    ["1", "1", "1"],
    ["1", "0", "1"],
    ["1", "1", "1"],
  ];
  const cells = {
    "0": {
      floorHeight: 0,
      ceilingHeight: 2.5,
      sections: [],
      floor: floorAndCeiling,
      ceiling: floorAndCeiling,
      blocking: false,
      fog: null,
    },
    "1": {
      floorHeight: 0,
      ceilingHeight: 2.5,
      sections: [{ bottom: 0, top: 2.5, material: wall }],
      floor: null,
      ceiling: null,
      blocking: true,
      fog: { distance: 20, color: { r: 10, g: 20, b: 30 } },
    },
  };
  return { level, map, cells, wall, floorAndCeiling };
}

function testBuildGeometryBatchesRing() {
  const { level, map, cells, wall, floorAndCeiling } = buildRingLevel();
  const batches = buildGeometryBatches(level, map, cells, 4);

  assert.equal(batches.size, 2, "expected exactly one batch per distinct material");

  // Every solid cell (8 of them) contributes exactly 4 side faces and no
  // caps (an ordinary full-height single-section wall's own bottom/top
  // already equal the cell's floor/ceiling -- see drawSectionCaps()'s
  // "an ordinary full-height wall draws zero caps" invariant): 8 cells * 4
  // quads * 6 vertices/quad = 192.
  const wallVertices = batches.get(wall);
  assert.ok(wallVertices, "wall material batch missing");
  assert.equal(wallVertices.length / 10, 192);

  // One floor quad + one ceiling quad for the single open cell, sharing one
  // material object: 2 quads * 6 vertices = 12.
  const floorVertices = batches.get(floorAndCeiling);
  assert.ok(floorVertices, "floor/ceiling material batch missing");
  assert.equal(floorVertices.length / 10, 12);

  // Fog is baked per vertex from the CURRENT cell (the wall cells set fog,
  // the open cell doesn't) -- spot-check one wall vertex and one floor
  // vertex.
  assert.equal(wallVertices[5], 20, "wall vertex should carry its cell's fog distance");
  assert.equal(wallVertices[6], 10, "wall vertex should carry its cell's fog color.r");
  assert.equal(floorVertices[5], 0, "floor vertex should carry no fog (fogDistance 0)");

  console.log("PASS buildGeometryBatches: ring level batches by material identity");
}

// A single cell with a non-full-height section (a sill from 0..1 in a cell
// whose own floor/ceiling are 0/2.5) should get exactly one cap (the top of
// the sill, since 1 < 2.5) and no bottom cap (0 is not > floorHeight 0) --
// see drawSectionCaps()'s neighbour-gap logic.
function testBuildGeometryBatchesSectionCap() {
  const material = makeMaterial();
  const level = { width: 1, height: 1 };
  const map = [["0"]];
  const cells = {
    "0": {
      floorHeight: 0,
      ceilingHeight: 2.5,
      sections: [{ bottom: 0, top: 1, material }],
      floor: null,
      ceiling: null,
      fog: null,
    },
  };
  const batches = buildGeometryBatches(level, map, cells, 4);
  const vertices = batches.get(material);
  assert.ok(vertices);
  // 4 side faces + 1 top cap = 5 quads * 6 vertices = 30.
  assert.equal(vertices.length / 10, 30);
  console.log("PASS buildGeometryBatches: sill section emits exactly one cap");
}

function createMockGl() {
  let nextId = 1;
  const drawCalls = [];
  const gl = {
    ARRAY_BUFFER: 1,
    BLEND: 2,
    COLOR_BUFFER_BIT: 3,
    COMPILE_STATUS: 4,
    CULL_FACE: 5,
    DEPTH_BUFFER_BIT: 6,
    DEPTH_TEST: 7,
    DYNAMIC_DRAW: 8,
    FLOAT: 9,
    FRAGMENT_SHADER: 10,
    LESS: 11,
    LINES: 12,
    LINK_STATUS: 13,
    NEAREST: 14,
    ONE_MINUS_SRC_ALPHA: 15,
    REPEAT: 16,
    RGBA: 17,
    SRC_ALPHA: 18,
    STATIC_DRAW: 19,
    TEXTURE0: 20,
    TEXTURE_2D: 21,
    TEXTURE_MAG_FILTER: 22,
    TEXTURE_MIN_FILTER: 23,
    TEXTURE_WRAP_S: 24,
    TEXTURE_WRAP_T: 25,
    TRIANGLES: 26,
    UNSIGNED_BYTE: 27,
    VERTEX_SHADER: 28,

    createShader: () => ({ id: nextId++ }),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    createProgram: () => ({ id: nextId++ }),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    deleteShader: () => {},
    deleteProgram: () => {},
    getUniformLocation: (_program, name) => ({ name }),
    useProgram: () => {},
    uniform1i: () => {},
    uniform1f: () => {},
    uniform1iv: () => {},
    uniform3f: () => {},
    uniform4fv: () => {},
    uniformMatrix4fv: (_loc, transpose, data) => {
      assert.equal(transpose, false, "uniformMatrix4fv must be called with transpose=false");
      assert.ok(data instanceof Float32Array && data.length === 16, "expected a 16-float matrix");
    },
    activeTexture: () => {},
    bindTexture: () => {},
    createTexture: () => ({ id: nextId++ }),
    deleteTexture: () => {},
    texImage2D: () => {},
    texParameteri: () => {},
    createBuffer: () => ({ id: nextId++ }),
    bindBuffer: () => {},
    bufferData: (_target, data) => {
      assert.ok(
        data instanceof Float32Array || typeof data === "number",
        "bufferData given unexpected data shape",
      );
    },
    createVertexArray: () => ({ id: nextId++ }),
    bindVertexArray: () => {},
    deleteVertexArray: () => {},
    deleteBuffer: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    viewport: () => {},
    clearColor: () => {},
    clear: () => {},
    enable: () => {},
    disable: () => {},
    depthFunc: () => {},
    depthMask: () => {},
    blendFunc: () => {},
    drawArrays: (mode, _first, count) => {
      assert.ok(Number.isFinite(count) && count >= 0, "drawArrays given a bad vertex count");
      drawCalls.push({ mode, count });
    },
  };
  return { gl, drawCalls };
}

function makeCanvasFactory(webglResult) {
  return () => ({
    width: 0,
    height: 0,
    getContext(type) {
      if (type === "2d") {
        return {
          imageSmoothingEnabled: true,
          createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          drawImage: () => {},
          putImageData: () => {},
        };
      }
      if (type === "webgl2") return webglResult;
      return null;
    },
  });
}

async function withFakeDom(canvasFactory, fn) {
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, "document");
  const previousDocument = globalThis.document;
  const hadPixi = Object.prototype.hasOwnProperty.call(globalThis, "PIXI");
  const previousPixi = globalThis.PIXI;
  globalThis.document = { createElement: canvasFactory };
  globalThis.PIXI = { Texture: { fromCanvas: (canvas) => ({ canvas }) } };
  try {
    return await fn();
  } finally {
    if (hadDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
    if (hadPixi) globalThis.PIXI = previousPixi;
    else delete globalThis.PIXI;
  }
}

function createFakeGame() {
  return {
    width: 320,
    height: 180,
    add: {
      sprite: () => ({
        loadTexture() {},
        smoothed: true,
        scale: { set() {} },
        destroy() {},
      }),
      bitmapData: () => ({ context: { putImageData() {} }, dirty: false }),
    },
    cache: {
      getImage: () => ({ width: 8, height: 8 }),
    },
  };
}

function buildRendererState(overrides = {}) {
  const level = { width: 1, height: 1 };
  return {
    width: 16,
    height: 9,
    cellSize: 4,
    fov: Math.PI / 3,
    maxDistance: 100,
    cameraHeight: 1,
    debug: false,
    level,
    map: [["0"]],
    cells: { "0": { floorHeight: 0, ceilingHeight: 2.5, sections: [], floor: null, ceiling: null } },
    defaultFogColor: { r: 70, g: 110, b: 160 },
    defaultDebugColor: { r: 255, g: 0, b: 255 },
    sky: null,
    loadSpriteSurface: () => null,
    ...overrides,
  };
}

function makeFallback(state) {
  return {
    updateProjection() {},
    resolveLights: (lights) => SoftwareRenderer.prototype.resolveLights.call({}, lights),
    getCell: () => state.cells["0"],
    getSpriteCameraSpace: (camera, sprite) => ({
      depth: (sprite.x ?? 0) - (camera.x ?? 0) + 1,
    }),
    renderSnapshot(camera) {
      this.lastCameraSeen = camera;
    },
  };
}

async function testFallbackWhenWebgl2Unsupported() {
  await withFakeDom(makeCanvasFactory(null), async () => {
    const state = buildRendererState();
    const fallback = makeFallback(state);
    const renderer = new WebGLRenderer(state, fallback);

    assert.equal(renderer.ready, false);
    assert.ok(renderer.failed instanceof Error);

    const camera = { x: 1, y: 2, angle: 0.5 };
    renderer.renderSnapshot(camera);
    assert.equal(fallback.lastCameraSeen, camera, "must delegate to fallback unchanged");

    assert.equal(typeof renderer.updateWorldFromState, "function");
    assert.equal(typeof renderer.updateCellFromState, "function");
    assert.doesNotThrow(() => renderer.destroy());
  });
  console.log("PASS WebGLRenderer falls back to SoftwareRenderer when WebGL2 is unavailable");
}

async function testReadyLifecycle() {
  const { gl, drawCalls } = createMockGl();
  await withFakeDom(makeCanvasFactory(gl), async () => {
    const { level, map, cells, wall } = buildRingLevel();
    const state = buildRendererState({ level, map, cells, debug: true });
    const fallback = makeFallback(state);
    const renderer = new WebGLRenderer(state, fallback);

    assert.equal(renderer.ready, true, renderer.failed?.message);
    assert.equal(renderer.opaqueBatches.length, 2);

    const camera = {
      x: 6,
      y: 6,
      z: 1,
      angle: 0.3,
      pitch: -4,
      ambient: 0.5,
      lights: [{ x: 6, y: 6, z: 1, radius: 10, intensity: 1, tint: { r: 255, g: 255, b: 255 } }],
      sprites: [],
      debugObjects: [],
    };
    assert.doesNotThrow(() => renderer.renderSnapshot(camera));
    assert.ok(drawCalls.length >= 3, "expected at least sky + 2 opaque batches to draw");
    assert.equal(fallback.lastLighting.active, true);
    assert.equal(fallback.lastLighting.lights.length, 1);
    assert.ok(renderer.debugStats.frameMs > 0);
    assert.equal(fallback.debugStats, renderer.debugStats);

    // Simulate a door opening (setCellSections/setCellBlocking mutate the
    // cell object in place, then notify) -- the wall batch should vanish.
    cells["1"].sections = [];
    renderer.updateCellFromState("1", cells["1"]);
    assert.equal(renderer.opaqueBatches.length, 1);
    assert.doesNotThrow(() => renderer.renderSnapshot(camera));

    assert.doesNotThrow(() => renderer.destroy());
  });
  console.log("PASS WebGLRenderer full lifecycle against a mock WebGL2 context");
}

function buildTinyLevel() {
  const wall = { texture: "wallTexture", width: 4, height: 4 };
  return {
    width: 3,
    height: 3,
    map: ["111", "101", "111"],
    cells: {
      0: { floorHeight: 0, ceilingHeight: 2.5, floor: { texture: "floorTexture" } },
      1: { floorHeight: 0, ceilingHeight: 2.5, wall },
    },
  };
}

async function testRaycasterSelectsWebGLRenderer() {
  const { gl } = createMockGl();
  await withFakeDom(makeCanvasFactory(gl), async () => {
    const raycaster = new Raycaster(createFakeGame(), buildTinyLevel(), {
      width: 16,
      height: 9,
      cellSize: 4,
      renderer: "webgl",
      debug: false,
    });
    assert.ok(raycaster.renderer instanceof WebGLRenderer);
    assert.equal(raycaster.renderer.ready, true, raycaster.renderer.failed?.message);
    assert.equal(raycaster.texture, null, "webgl path must not use a BitmapData texture");
    assert.doesNotThrow(() =>
      raycaster.renderSnapshot({ x: 4, y: 4, angle: 0 }),
    );
    raycaster.destroy();
  });
  console.log("PASS Raycaster({renderer: \"webgl\"}) selects and drives WebGLRenderer");
}

async function testRaycasterFallsBackThroughPublicApi() {
  await withFakeDom(makeCanvasFactory(null), async () => {
    const raycaster = new Raycaster(createFakeGame(), buildTinyLevel(), {
      width: 16,
      height: 9,
      cellSize: 4,
      renderer: "webgl",
      debug: false,
    });
    assert.ok(raycaster.renderer instanceof WebGLRenderer);
    assert.equal(raycaster.renderer.ready, false);
    // Falls back to the ordinary BitmapData texture path, exactly like the
    // default (no renderer option) case.
    assert.ok(raycaster.texture, "must fall back to a BitmapData texture");
    assert.doesNotThrow(() =>
      raycaster.renderSnapshot({ x: 4, y: 4, angle: 0 }),
    );
    raycaster.destroy();
  });
  console.log(
    "PASS Raycaster({renderer: \"webgl\"}) falls back to software rendering when WebGL2 is unavailable",
  );
}

testBuildGeometryBatchesRing();
testBuildGeometryBatchesSectionCap();
await testFallbackWhenWebgl2Unsupported();
await testReadyLifecycle();
await testRaycasterSelectsWebGLRenderer();
await testRaycasterFallsBackThroughPublicApi();
