// Deterministic JS/WASM comparison: renders the identical scene (walls,
// variable heights, floors, ceilings) through both SoftwareRenderer and the
// real WasmRenderer -> RaycasterRenderer.wasm path, and checks the results
// agree. Floating-point differences (float32 in C++ vs double in JS) are
// expected at edges; large geometric/texture/depth divergence is not -- see
// wasm-renderer-readme.md.
//
// Node has no browser `fetch` for file:// URLs, so this monkey-patches
// `fetch` just long enough to load the real .wasm binary through the actual
// Emscripten-generated loader -- the same module Raycaster/WasmRenderer use
// in the browser, not a hand-rolled stand-in.
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { Raycaster } from "../scripts/system/Raycaster.js";

async function withWasmFetch(fn) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    if (target.endsWith("RaycasterRenderer.wasm")) {
      const buffer = await fs.readFile(fileURLToPath(target));
      return new Response(buffer, {
        status: 200,
        headers: { "Content-Type": "application/wasm" },
      });
    }
    return realFetch(url, init);
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
}

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
        // Distinct flat colours per texture key so wall/floor/ceiling
        // materials are visually distinguishable in the comparison.
        // spriteTexture carries a transparent border (alpha 0) around an
        // opaque core so alpha/depth-test behaviour is actually exercised,
        // not just solid-quad coverage. skyTexture's red channel varies
        // per column so panoramic angle-based sampling is actually
        // exercised, not just a flat colour matching by coincidence.
        getImageData(x, y, width, height, key) {
          const data = new Uint8ClampedArray(width * height * 4);
          const colors = {
            wallTexture: [200, 100, 50],
            floorTexture: [40, 160, 60],
            ceilingTexture: [60, 90, 200],
            skyTexture: [90, 60, 150],
          };
          const [r, g, b] = colors[key] ?? [180, 180, 180];
          for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
              const i = (py * width + px) * 4;
              data[i] = key === "skyTexture" ? r + px * 3 : r;
              data[i + 1] = g;
              data[i + 2] = b;
              const isBorder =
                key === "spriteTexture" &&
                (px === 0 || py === 0 || px === width - 1 || py === height - 1);
              data[i + 3] = isBorder ? 0 : 255;
            }
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
  const images = {
    wallTexture: { width: 4, height: 4 },
    floorTexture: { width: 4, height: 4 },
    ceilingTexture: { width: 4, height: 4 },
    spriteTexture: { width: 8, height: 8 },
    skyTexture: { width: 16, height: 8 },
  };
  return {
    width: 640,
    height: 480,
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
      getImage(key) {
        return images[key] ?? { width: 4, height: 4 };
      },
    },
  };
}

// decodeImagePixels() calls canvas.getContext().getImageData(0,0,w,h) with
// no texture-key argument, so the fake canvas above needs the key threaded
// through drawImage -> getImageData to pick a distinct colour per material.
// Patch the fake canvas context to remember the last drawImage's image
// object (which carries the originating texture key via a closure below).
function createFakeCanvasWithKeys() {
  const canvas = createFakeCanvas();
  const realGetContext = canvas.getContext.bind(canvas);
  canvas.getContext = () => {
    const ctx = realGetContext();
    let lastKey;
    const realDrawImage = ctx.drawImage.bind(ctx);
    ctx.drawImage = (image) => {
      lastKey = image?.key;
      realDrawImage();
    };
    const realGetImageData = ctx.getImageData.bind(ctx);
    ctx.getImageData = (x, y, w, h) => realGetImageData(x, y, w, h, lastKey);
    return ctx;
  };
  return canvas;
}

// Awaits `fn()` (it may be sync or async) before restoring `document` --
// sprite texture decoding happens lazily inside renderSnapshot() itself
// (see WasmRenderer.resolveSpriteTextureId()), so `document` has to stay
// patched across an await, not just across the constructor call.
async function withFakeDom(fn) {
  const hadDocument = Object.prototype.hasOwnProperty.call(
    globalThis,
    "document",
  );
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => createFakeCanvasWithKeys() };
  try {
    return await fn();
  } finally {
    if (hadDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
  }
}

function createFakeGameWithKeyedImages() {
  const game = createFakeGame();
  const realGetImage = game.cache.getImage.bind(game.cache);
  game.cache.getImage = (key) => ({ ...realGetImage(key), key });
  return game;
}

function buildLevel() {
  return {
    width: 6,
    height: 3,
    map: ["111111", "100001", "111111"],
    cells: {
      0: {
        floorHeight: 0,
        ceilingHeight: 2.5,
        floor: { texture: "floorTexture", width: 4, height: 4 },
        ceiling: { texture: "ceilingTexture", width: 4, height: 4 },
      },
      1: {
        floorHeight: 0,
        ceilingHeight: 2.5,
        wall: { texture: "wallTexture", width: 4, height: 4 },
      },
    },
  };
}

const OPTIONS = { width: 80, height: 60, cellSize: 4, cameraHeight: 1 };
const CAMERA = { x: 6, y: 6, z: 1, angle: 0, pitch: 0 };

function countByAlpha(pixels) {
  let opaque = 0;
  let transparent = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] === 255) opaque++;
    else transparent++;
  }
  return { opaque, transparent };
}

function pixelAt(pixels, width, x, y) {
  const index = (y * width + x) * 4;
  return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
}

async function renderPair(level, options, camera) {
  const jsFrame = await withFakeDom(() => {
    const raycaster = new Raycaster(
      createFakeGameWithKeyedImages(),
      level,
      options,
    );
    raycaster.renderSnapshot(camera);
    return Uint8ClampedArray.from(raycaster.imageData.data);
  });

  const wasmFrame = await withFakeDom(async () => {
    const wasmRaycaster = new Raycaster(createFakeGameWithKeyedImages(), level, {
      ...options,
      renderer: "wasm",
    });
    await wasmRaycaster.renderer.initializing;
    assert.equal(
      wasmRaycaster.renderer.ready,
      true,
      `WASM renderer failed to initialise: ${wasmRaycaster.renderer.failed}`,
    );
    wasmRaycaster.renderSnapshot(camera);
    const frame = Uint8ClampedArray.from(wasmRaycaster.imageData.data);
    wasmRaycaster.destroy();
    return frame;
  });
  return { jsFrame, wasmFrame };
}

async function testWallsFloorsCeilings() {
  await withWasmFetch(async () => {
    const { jsFrame, wasmFrame } = await renderPair(
      buildLevel(),
      OPTIONS,
      CAMERA,
    );

    const width = OPTIONS.width;
    const height = OPTIONS.height;

    // Centre column, straight down the corridor: must hit the same far
    // wall pixel in both renderers, with no lighting/fog in play to blur
    // the comparison -- an exact match is expected here, same as the
    // corridor comparison recorded in wasm-renderer-readme.md.
    const centerWall = pixelAt(jsFrame, width, width / 2, height / 2);
    const centerWallWasm = pixelAt(wasmFrame, width, width / 2, height / 2);
    assert.deepEqual(
      centerWallWasm,
      centerWall,
      `center wall pixel mismatch: js=${centerWall} wasm=${centerWallWasm}`,
    );
    assert.deepEqual(centerWall.slice(0, 3), [200, 100, 50]);

    // Floor sample: bottom-centre of the screen, below the horizon, well
    // before the far wall -- must be the floor colour in both.
    const floorY = Math.floor(height * 0.85);
    const floorJs = pixelAt(jsFrame, width, width / 2, floorY);
    const floorWasm = pixelAt(wasmFrame, width, width / 2, floorY);
    assert.deepEqual(floorJs.slice(0, 3), [40, 160, 60]);
    assert.deepEqual(
      floorWasm,
      floorJs,
      `floor pixel mismatch: js=${floorJs} wasm=${floorWasm}`,
    );

    // Ceiling sample: top-centre of the screen, above the horizon.
    const ceilingY = Math.floor(height * 0.1);
    const ceilingJs = pixelAt(jsFrame, width, width / 2, ceilingY);
    const ceilingWasm = pixelAt(wasmFrame, width, width / 2, ceilingY);
    assert.deepEqual(ceilingJs.slice(0, 3), [60, 90, 200]);
    assert.deepEqual(
      ceilingWasm,
      ceilingJs,
      `ceiling pixel mismatch: js=${ceilingJs} wasm=${ceilingWasm}`,
    );

    // Whole-frame aggregate: opaque pixel counts (walls + floor + ceiling)
    // must be very close -- small float32-vs-double rasterisation
    // differences at edges are expected, a large mismatch is not.
    const jsCounts = countByAlpha(jsFrame);
    const wasmCounts = countByAlpha(wasmFrame);
    const totalPixels = width * height;
    const diff = Math.abs(jsCounts.opaque - wasmCounts.opaque);
    assert.ok(
      diff / totalPixels < 0.02,
      `opaque pixel counts diverge too much: js=${jsCounts.opaque} wasm=${wasmCounts.opaque} (${diff} px, ${((diff / totalPixels) * 100).toFixed(2)}%)`,
    );

    console.log(
      `PASS walls/floors/ceilings parity (js opaque=${jsCounts.opaque}, wasm opaque=${wasmCounts.opaque}, diff=${diff}px)`,
    );
  });
}

// Windowed boundary (sill + lintel with an open gap) followed by a second,
// farther wall only visible through the gap: exercises multi-segment
// traversal, section caps (drawSectionCaps), and the visible-interval
// bookkeeping that closes a column once fully occluded -- none of which the
// single-hit-then-stop C++ implementation this replaced could do at all.
function buildWindowLevel() {
  const wallMaterial = { texture: "wallTexture", width: 4, height: 4 };
  return {
    width: 8,
    height: 3,
    map: ["11111111", "10020001", "11111111"],
    cells: {
      0: {
        floorHeight: 0,
        ceilingHeight: 4,
        floor: { texture: "floorTexture", width: 4, height: 4 },
        ceiling: { texture: "ceilingTexture", width: 4, height: 4 },
      },
      1: { floorHeight: 0, ceilingHeight: 4, wall: wallMaterial },
      2: {
        floorHeight: 0,
        ceilingHeight: 4,
        sections: [
          { bottom: 0, top: 1, material: wallMaterial },
          { bottom: 3, top: 4, material: wallMaterial },
        ],
      },
    },
  };
}

async function testWindowedBoundary() {
  await withWasmFetch(async () => {
    const options = { width: 80, height: 60, cellSize: 4, cameraHeight: 1.5 };
    const camera = { x: 6, y: 6, z: 1.5, angle: 0, pitch: 0 };
    const { jsFrame, wasmFrame } = await renderPair(
      buildWindowLevel(),
      options,
      camera,
    );

    const jsCounts = countByAlpha(jsFrame);
    const wasmCounts = countByAlpha(wasmFrame);
    const totalPixels = options.width * options.height;
    const diff = Math.abs(jsCounts.opaque - wasmCounts.opaque);
    assert.ok(
      diff / totalPixels < 0.02,
      `windowed-boundary opaque counts diverge: js=${jsCounts.opaque} wasm=${wasmCounts.opaque} (${diff} px)`,
    );
    // The far wall (through the gap) must actually be reached in both --
    // a strip through the middle rows (where the gap sits) must show
    // something other than the near boundary's own sill/lintel colour,
    // i.e. the ray actually continued past the first cell boundary.
    const midRow = Math.floor(options.height / 2);
    const farWallJs = pixelAt(jsFrame, options.width, options.width / 2, midRow);
    const farWallWasm = pixelAt(
      wasmFrame,
      options.width,
      options.width / 2,
      midRow,
    );
    assert.deepEqual(farWallJs.slice(0, 3), [200, 100, 50]);
    assert.deepEqual(
      farWallWasm,
      farWallJs,
      `far-wall-through-gap pixel mismatch: js=${farWallJs} wasm=${farWallWasm}`,
    );
    console.log(
      `PASS windowed boundary / multi-segment parity (js opaque=${jsCounts.opaque}, wasm opaque=${wasmCounts.opaque}, diff=${diff}px)`,
    );
  });
}

// Lighting + fog: exercises sampleLight() and the fog blend math on both
// walls and floor/ceiling planes, not just the unlit fast path above.
function buildLitFoggyLevel() {
  return {
    width: 6,
    height: 3,
    map: ["111111", "100001", "111111"],
    cells: {
      0: {
        floorHeight: 0,
        ceilingHeight: 2.5,
        floor: { texture: "floorTexture", width: 4, height: 4 },
        ceiling: { texture: "ceilingTexture", width: 4, height: 4 },
        fog: { distance: 10, color: { r: 20, g: 20, b: 40 } },
      },
      1: {
        floorHeight: 0,
        ceilingHeight: 2.5,
        wall: { texture: "wallTexture", width: 4, height: 4 },
      },
    },
  };
}

async function testLightingAndFog() {
  await withWasmFetch(async () => {
    const camera = {
      ...CAMERA,
      lights: [
        {
          x: 10,
          y: 6,
          z: 1,
          radius: 12,
          intensity: 1.5,
          tint: { r: 255, g: 220, b: 180 },
        },
      ],
      ambient: 0.4,
    };
    const { jsFrame, wasmFrame } = await renderPair(
      buildLevel(),
      OPTIONS,
      camera,
    );

    const width = OPTIONS.width;
    const height = OPTIONS.height;
    let sampledOpaque = 0;
    let boundaryFlips = 0;
    let worstNonBoundaryDiff = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const js = pixelAt(jsFrame, width, x, y);
        const wasm = pixelAt(wasmFrame, width, x, y);
        if (js[3] !== 255 && wasm[3] !== 255) continue;
        sampledOpaque++;
        const channelDiff = Math.max(
          Math.abs(js[0] - wasm[0]),
          Math.abs(js[1] - wasm[1]),
          Math.abs(js[2] - wasm[2]),
        );
        // A handful of pixels sitting exactly on a wall/plane boundary can
        // round to a different row between float32 (C++) and float64 (JS)
        // trig -- e.g. a wall's top edge lands on integer row 12.0 vs
        // 11.999998, flipping which surface (wall vs ceiling) that single
        // row belongs to. That single-row disagreement is expected (see
        // wasm-renderer-readme.md's 764-vs-766-pixel corridor comparison)
        // and shows up as one large-looking colour jump; anything else
        // must stay tiny (lighting/fog use identical formulas on both
        // sides).
        if (channelDiff > 20) boundaryFlips++;
        else worstNonBoundaryDiff = Math.max(worstNonBoundaryDiff, channelDiff);
      }
    }
    // Lit/fogged output must actually differ from the flat unlit baseline
    // (sanity: lighting/fog is really being exercised)...
    assert.ok(sampledOpaque > 0);
    assert.ok(
      boundaryFlips / sampledOpaque < 0.01,
      `too many boundary-flip pixels: ${boundaryFlips} of ${sampledOpaque}`,
    );
    assert.ok(
      worstNonBoundaryDiff <= 2,
      `lit/fogged pixel channel diff too large away from boundaries: ${worstNonBoundaryDiff}`,
    );
    console.log(
      `PASS lighting/fog parity (boundary flips=${boundaryFlips}, worst other diff=${worstNonBoundaryDiff}, over ${sampledOpaque} opaque px)`,
    );
  });
}

// Billboard sprites: exercises WasmRenderer.resolveSpriteTextureId() (lazy
// string-key -> native-texture-id resolution, the piece that was entirely
// missing before -- sprite.textureId never existed anywhere in the real
// sprite data model) plus the native billboard projection/depth-test/alpha
// path itself.
async function testBillboardSprites() {
  await withWasmFetch(async () => {
    const camera = {
      ...CAMERA,
      sprites: [
        // In front of the camera, well before the far wall (depth 6 vs
        // the wall's depth 14 -- clearly nearer, no depth-test tie).
        {
          x: 12,
          y: 6,
          z: 0,
          width: 2,
          height: 2,
          scale: 1,
          texture: "spriteTexture",
          billboard: true,
        },
        // Farther than the first sprite but still well short of the wall,
        // and offset to one side -- exercises depth ordering and lateral
        // projection together with the first sprite, without the two
        // overlapping on screen or tying in depth with each other or the
        // wall (ties are expected to round differently between C++'s
        // float32 and JS's double, same as the wall/plane boundary flips
        // elsewhere in this file -- this scene deliberately avoids them so
        // the sprite path itself is what's being checked here).
        {
          x: 16,
          y: 4,
          z: 0,
          width: 1.5,
          height: 1.5,
          scale: 1,
          texture: "spriteTexture",
          billboard: true,
        },
      ],
    };
    const { jsFrame, wasmFrame } = await renderPair(
      buildLevel(),
      OPTIONS,
      camera,
    );

    const { mismatches, spriteOpaquePixels } = compareSpriteFrames(
      jsFrame,
      wasmFrame,
      OPTIONS.width,
      OPTIONS.height,
    );
    // Sanity: the sprites must actually be visible (their fallback grey
    // [180,180,180] is distinct from every wall/floor/ceiling colour), or
    // this test would silently pass without exercising anything.
    assert.ok(spriteOpaquePixels > 0, "no sprite pixels were drawn at all");
    // Only the same handful of wall/ceiling boundary-flip pixels seen in
    // the unlit walls/floors/ceilings scene (float32-vs-double rounding at
    // an exact row boundary) are expected here; the sprites themselves
    // were placed to avoid any depth ties, so a mismatch count much above
    // that baseline points at a real sprite-path bug, not rounding noise.
    assert.ok(
      mismatches <= 15,
      `too many sprite-frame pixel mismatches: ${mismatches} (expected roughly the ~9-pixel wall/ceiling boundary-flip baseline)`,
    );
    console.log(
      `PASS billboard sprite parity (sprite px=${spriteOpaquePixels}, mismatches=${mismatches})`,
    );
  });
}

// Shared by the billboard and oriented-sprite scenarios: counts pixels
// where the two frames disagree, and how many pixels the sprites'
// fallback-grey colour actually reached (a sanity check that the scene
// exercised anything at all).
function compareSpriteFrames(jsFrame, wasmFrame, width, height) {
  let mismatches = 0;
  let spriteOpaquePixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const js = pixelAt(jsFrame, width, x, y);
      const wasm = pixelAt(wasmFrame, width, x, y);
      if (js[0] === 180 && js[1] === 180 && js[2] === 180 && js[3] === 255)
        spriteOpaquePixels++;
      if (
        js[0] !== wasm[0] ||
        js[1] !== wasm[1] ||
        js[2] !== wasm[2] ||
        js[3] !== wasm[3]
      ) {
        mismatches++;
      }
    }
  }
  return { mismatches, spriteOpaquePixels };
}

// Oriented (non-billboard) sprites: exercises renderOrientedSprite()'s
// perspective-correct per-column depth/texture-U interpolation, mixed with
// a billboard so the two sprite kinds are exercised together in the same
// depth-sorted draw order.
async function testOrientedSprites() {
  await withWasmFetch(async () => {
    const camera = {
      ...CAMERA,
      sprites: [
        // Oriented, angled across the view -- its two edges sit at
        // different depths/laterals, which is exactly what the
        // perspective-correct interpolation this test targets has to get
        // right.
        {
          x: 12,
          y: 6,
          z: 0,
          width: 2,
          height: 2,
          scale: 1,
          angle: Math.PI / 6,
          texture: "spriteTexture",
          billboard: false,
        },
        // A second oriented sprite, angled the other way, at a clearly
        // different depth/lateral offset from the first (no overlap, no
        // depth ties).
        {
          x: 16,
          y: 4,
          z: 0,
          width: 1.5,
          height: 1.5,
          scale: 1,
          angle: -Math.PI / 4,
          texture: "spriteTexture",
          billboard: false,
        },
        // A billboard mixed in at yet another depth, to check the two
        // sprite kinds share the same depth-sort order correctly.
        {
          x: 10,
          y: 8,
          z: 0,
          width: 1,
          height: 1,
          scale: 1,
          texture: "spriteTexture",
          billboard: true,
        },
      ],
    };
    const { jsFrame, wasmFrame } = await renderPair(
      buildLevel(),
      OPTIONS,
      camera,
    );

    const { mismatches, spriteOpaquePixels } = compareSpriteFrames(
      jsFrame,
      wasmFrame,
      OPTIONS.width,
      OPTIONS.height,
    );
    assert.ok(spriteOpaquePixels > 0, "no sprite pixels were drawn at all");
    // A sprite's own two edges are independently projected and can each
    // land near a row/column boundary, so a slightly larger baseline than
    // the billboard scene's is reasonable here -- still expected to be a
    // small edge-rounding effect, not a systemic mismatch.
    assert.ok(
      mismatches <= 30,
      `too many oriented-sprite-frame pixel mismatches: ${mismatches}`,
    );
    console.log(
      `PASS oriented sprite parity (sprite px=${spriteOpaquePixels}, mismatches=${mismatches})`,
    );
  });
}

// Panoramic sky: exercises WasmRenderer.uploadSky() (a texture upload that
// doesn't go through the material or sprite-texture id paths) and
// fillTexturedSky()'s angle-based column sampling. An open-ceiling room
// (no ceiling material) is required -- an enclosed room's ceiling plane
// would cover the entire sky region and the sky would never actually be
// visible, silently defeating the test.
function buildOpenSkyLevel() {
  return {
    width: 6,
    height: 3,
    map: ["111111", "100001", "111111"],
    cells: {
      0: {
        floorHeight: 0,
        ceilingHeight: 6,
        floor: { texture: "floorTexture", width: 4, height: 4 },
        ceiling: null,
      },
      1: {
        floorHeight: 0,
        ceilingHeight: 6,
        wall: { texture: "wallTexture", width: 4, height: 4 },
      },
    },
    sky: { texture: "skyTexture" },
  };
}

async function testTexturedSky() {
  await withWasmFetch(async () => {
    const { jsFrame, wasmFrame } = await renderPair(
      buildOpenSkyLevel(),
      OPTIONS,
      CAMERA,
    );

    const width = OPTIONS.width;
    const height = OPTIONS.height;
    let mismatches = 0;
    let skyPixels = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const js = pixelAt(jsFrame, width, x, y);
        const wasm = pixelAt(wasmFrame, width, x, y);
        // Blue channel 150 uniquely identifies a sky pixel among this
        // scene's wall/floor colours.
        if (js[2] === 150) skyPixels++;
        if (
          js[0] !== wasm[0] ||
          js[1] !== wasm[1] ||
          js[2] !== wasm[2] ||
          js[3] !== wasm[3]
        ) {
          mismatches++;
        }
      }
    }
    // Sanity: the open ceiling must actually reveal sky, or this test
    // would silently pass without exercising the textured-sky path at all.
    assert.ok(skyPixels > 0, "no sky pixels were drawn at all");
    assert.equal(
      mismatches,
      0,
      `sky pixel mismatches: ${mismatches} (expected pixel-identical -- no lighting/fog/depth-test rounding is involved in sky sampling)`,
    );
    console.log(`PASS textured sky parity (sky px=${skyPixels}, mismatches=0)`);
  });
}

// Debug overlays (sprite anchor crosshairs, collision-cylinder
// wireframes): these are intentionally JS-only (see
// wasm-renderer-readme.md) -- WasmRenderer.drawDebugOverlays() draws them
// onto the WASM-rendered framebuffer using the same JS SoftwareRenderer
// projection code the plain-JS path uses internally, so this should be an
// exact pixel match, not just "close". Regression test for the bug where
// these silently stopped appearing once real gameplay sessions opted into
// `renderer: "wasm"` -- WasmRenderer.renderSnapshot() had no debug-overlay
// step at all.
function countDebugPixels(frame) {
  let count = 0;
  for (let i = 0; i < frame.length; i += 4) {
    if (frame[i] === 255 && frame[i + 1] === 0 && frame[i + 2] === 255) {
      count++;
    }
  }
  return count;
}

async function testDebugOverlays() {
  await withWasmFetch(async () => {
    const options = { ...OPTIONS, debugSpriteAnchors: true };
    const camera = {
      ...CAMERA,
      sprites: [
        {
          x: 12,
          y: 6,
          z: 0,
          width: 2,
          height: 2,
          scale: 1,
          texture: "spriteTexture",
          billboard: true,
        },
        {
          x: 16,
          y: 4,
          z: 0,
          width: 1.5,
          height: 1.5,
          scale: 1,
          angle: Math.PI / 6,
          texture: "spriteTexture",
          billboard: false,
        },
      ],
      debugObjects: [
        { x: 12, y: 6, z: 0, radius: 1, height: 2, segments: 8 },
      ],
    };
    const { jsFrame, wasmFrame } = await renderPair(buildLevel(), options, camera);

    const jsDebugPixels = countDebugPixels(jsFrame);
    const wasmDebugPixels = countDebugPixels(wasmFrame);
    assert.ok(jsDebugPixels > 0, "no debug overlay pixels drawn in JS reference");
    assert.equal(
      wasmDebugPixels,
      jsDebugPixels,
      `WASM debug overlay pixel count (${wasmDebugPixels}) does not match JS reference (${jsDebugPixels})`,
    );
    console.log(`PASS debug overlays on WASM path (debug px=${wasmDebugPixels})`);
  });
}

await testWallsFloorsCeilings();
await testWindowedBoundary();
await testLightingAndFog();
await testBillboardSprites();
await testOrientedSprites();
await testTexturedSky();
await testDebugOverlays();
console.log("\n7 wasm render parity tests passed.");
