// Repeatable JS-vs-WASM raycaster benchmark, run under Node the same way
// tests/wasm-render-parity.test.mjs does (a `fetch` shim feeds the real
// .wasm bytes to the Emscripten loader, since Node's `fetch` doesn't
// resolve `file:` URLs). This is a benchmark, not a test: it prints a
// report and exits 0 regardless of which renderer is faster -- see
// wasm-renderer-readme.md's "Do not claim performance improvements
// without measurement" instruction. Run with:
//
//   npm run benchmark:raycaster
//
// The scene deliberately exercises every feature both renderers now share
// (variable wall heights, floors, ceilings, a windowed boundary, lighting,
// fog, a panoramic sky, and both billboard and oriented sprites) and moves
// the camera every frame on a fixed, seed-free path (sine/cosine, no
// Math.random) so results are reproducible on the same machine without
// degenerating into measuring one static, branch-predictor-friendly frame.
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { Raycaster } from "../scripts/system/Raycaster.js";

const WARMUP_FRAMES = 30;
const MEASURED_FRAMES = 500;

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

// Same fake DOM/game/texture-decode stand-ins as
// tests/wasm-render-parity.test.mjs -- see that file's comments for why
// each piece exists. Texture content doesn't matter for timing, so these
// are simpler (flat colours, no alpha border) than the parity test's.
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
        getImageData(x, y, width, height) {
          const data = new Uint8ClampedArray(width * height * 4);
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 180;
            data[i + 1] = 140;
            data[i + 2] = 120;
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
      getImage() {
        return { width: 8, height: 8 };
      },
    },
  };
}

async function withFakeDom(fn) {
  const hadDocument = Object.prototype.hasOwnProperty.call(
    globalThis,
    "document",
  );
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => createFakeCanvas() };
  try {
    return await fn();
  } finally {
    if (hadDocument) globalThis.document = previousDocument;
    else delete globalThis.document;
  }
}

// A 16x10 ring of rooms with variable wall/floor/ceiling heights, a
// windowed boundary, two fog zones, and an open-ceiling stretch under a
// panoramic sky -- enough geometric variety that sweeping the camera
// through it exercises most of the shared renderer surface, not just one
// corridor.
function buildBenchmarkLevel() {
  const wall = { texture: "wallTexture", width: 4, height: 4 };
  const floor = { texture: "floorTexture", width: 4, height: 4 };
  const ceiling = { texture: "ceilingTexture", width: 4, height: 4 };
  const rows = [
    "################",
    "#0000000030000##",
    "#0111101010111##",
    "#0100001010001##",
    "#0100001210001##",
    "#0100001010001##",
    "#0111101010111##",
    "#0000000030000##",
    "#0000000000000##",
    "################",
  ];
  return {
    width: rows[0].length,
    height: rows.length,
    map: rows,
    sky: { texture: "skyTexture" },
    cells: {
      0: {
        floorHeight: 0,
        ceilingHeight: 6,
        floor,
        ceiling,
        fog: { distance: 24, color: { r: 30, g: 30, b: 50 } },
      },
      1: { floorHeight: 0, ceilingHeight: 6, wall },
      2: {
        floorHeight: 0,
        ceilingHeight: 6,
        sections: [
          { bottom: 0, top: 1.5, material: wall },
          { bottom: 4.5, top: 6, material: wall },
        ],
      },
      // An open-ceiling stretch (no ceiling material) so the panoramic
      // sky is actually reachable, same requirement as
      // wasm-render-parity.test.mjs's buildOpenSkyLevel().
      3: { floorHeight: 0, ceilingHeight: 6, floor, ceiling: null },
    },
  };
}

function buildSprites() {
  const sprites = [];
  for (let i = 0; i < 6; i++) {
    sprites.push({
      x: 8 + (i % 3) * 8,
      y: 8 + Math.floor(i / 3) * 20,
      z: 0,
      width: 1.5,
      height: 1.5,
      scale: 1,
      texture: "spriteTexture",
      billboard: i % 2 === 0,
      angle: i * 0.5,
    });
  }
  return sprites;
}

// Fixed, seed-free camera sweep -- reproducible run to run, but different
// enough frame to frame that no single cached ray/segment result can carry
// the whole benchmark.
function cameraForFrame(frame) {
  const t = frame * 0.05;
  return {
    x: 32 + Math.sin(t * 0.7) * 20,
    y: 36 + Math.cos(t * 0.9) * 16,
    z: 1,
    angle: t * 0.6,
    pitch: Math.sin(t * 0.3) * 15,
    ambient: 0.5,
    lights: [
      {
        x: 32,
        y: 36,
        z: 1.5,
        radius: 18,
        intensity: 1.2,
        tint: { r: 255, g: 220, b: 180 },
      },
    ],
    sprites: buildSprites(),
  };
}

function percentile(sortedValues, fraction) {
  const index = Math.min(
    sortedValues.length - 1,
    Math.floor(sortedValues.length * fraction),
  );
  return sortedValues[index];
}

function summarize(samples) {
  const sorted = Float64Array.from(samples).sort();
  const sum = sorted.reduce((total, value) => total + value, 0);
  const mean = sum / sorted.length;
  const variance =
    sorted.reduce((total, value) => total + (value - mean) ** 2, 0) /
    sorted.length;
  return {
    count: sorted.length,
    avg: mean,
    stddev: Math.sqrt(variance),
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1],
  };
}

function formatMs(value) {
  return `${value.toFixed(3)}ms`;
}

function printSummary(label, samples) {
  const s = summarize(samples);
  console.log(
    `${label.padEnd(28)} avg=${formatMs(s.avg)} min=${formatMs(s.min)} ` +
      `p50=${formatMs(s.p50)} p95=${formatMs(s.p95)} p99=${formatMs(s.p99)} ` +
      `max=${formatMs(s.max)} stddev=${formatMs(s.stddev)} (n=${s.count})`,
  );
  return s;
}

async function run() {
  // `document` has to stay patched across the whole benchmark, not just
  // construction -- sprite/sky texture decoding happens lazily on first
  // use inside renderSnapshot() itself (see
  // WasmRenderer.resolveSpriteTextureId()/uploadSky()), which fires during
  // the warm-up frames below, not the constructor call.
  await withWasmFetch(() => withFakeDom(async () => {
    const level = buildBenchmarkLevel();
    const options = { width: 240, height: 135, cellSize: 4, cameraHeight: 1 };

    const jsRaycaster = new Raycaster(createFakeGame(), level, options);
    const wasmRaycaster = new Raycaster(createFakeGame(), level, {
      ...options,
      renderer: "wasm",
    });
    await wasmRaycaster.renderer.initializing;
    if (!wasmRaycaster.renderer.ready) {
      console.error(
        "WASM renderer failed to initialise:",
        wasmRaycaster.renderer.failed,
      );
      process.exitCode = 1;
      return;
    }

    // Warm-up: lets the JS engine JIT-compile the hot renderer methods and
    // gets past the wasm module's own first-call overhead, so the
    // measured frames reflect steady-state cost, not one-time warm-up.
    for (let frame = 0; frame < WARMUP_FRAMES; frame++) {
      const camera = cameraForFrame(frame);
      jsRaycaster.renderSnapshot(camera);
      wasmRaycaster.renderSnapshot(camera);
    }

    const jsFrameSamples = [];
    const wasmAdapterPackSamples = [];
    const wasmNativeSamples = [];
    const wasmTransferSamples = [];
    const wasmTotalSamples = [];

    for (let frame = 0; frame < MEASURED_FRAMES; frame++) {
      const camera = cameraForFrame(WARMUP_FRAMES + frame);

      const jsStart = performance.now();
      jsRaycaster.renderSnapshot(camera);
      jsFrameSamples.push(performance.now() - jsStart);

      // Mirrors WasmRenderer.renderSnapshot()'s own sequence exactly (see
      // scripts/system/WasmRenderer.js), just with timing checkpoints
      // between its steps -- the production render path itself carries no
      // extra instrumentation cost, this benchmark just calls the same
      // public methods it already exposes.
      const renderer = wasmRaycaster.renderer;
      const totalStart = performance.now();
      renderer.updateCamera(camera);
      renderer.updateFrame(camera.sprites, camera.lights, camera.ambient ?? 1);
      const nativeStart = performance.now();
      wasmAdapterPackSamples.push(nativeStart - totalStart);
      renderer.module._raycaster_render_snapshot(renderer.cameraPointer);
      const transferStart = performance.now();
      wasmNativeSamples.push(transferStart - nativeStart);
      const framebuffer = renderer.getFramebuffer();
      renderer.imageData.data.set(framebuffer);
      const transferEnd = performance.now();
      wasmTransferSamples.push(transferEnd - transferStart);
      wasmTotalSamples.push(transferEnd - totalStart);
    }

    console.log(
      `Raycaster JS/WASM benchmark -- ${options.width}x${options.height}, ` +
        `${MEASURED_FRAMES} measured frames (${WARMUP_FRAMES} warm-up, discarded)\n`,
    );
    const js = printSummary("SoftwareRenderer (JS) total", jsFrameSamples);
    console.log();
    printSummary("WASM adapter pack (JS)", wasmAdapterPackSamples);
    printSummary("WASM native render (C++)", wasmNativeSamples);
    printSummary("WASM framebuffer transfer", wasmTransferSamples);
    const wasm = printSummary("WASM total", wasmTotalSamples);
    console.log();
    console.log(
      `WASM total avg is ${(js.avg / wasm.avg).toFixed(2)}x the JS avg ` +
        `(>1 means WASM faster on average); p99 ratio is ` +
        `${(js.p99 / wasm.p99).toFixed(2)}x (worst-frame-time comparison).`,
    );
    console.log(
      "\nNote: this does not include the browser-side Phaser " +
        "BitmapData.putImageData() upload, which is identical for both " +
        "paths (the same imageData buffer flows through it either way) " +
        "and can't be measured meaningfully under Node's fake canvas. " +
        "Allocation/GC-pause profiling was intentionally not attempted " +
        "here either -- Node's heap stats reflect neither the JS engine's " +
        "real allocator behaviour nor the WASM module's linear memory, so " +
        "a number here would be misleading rather than informative; that " +
        "needs a browser memory profiler instead.",
    );

    wasmRaycaster.destroy();
  }));
}

await run();
