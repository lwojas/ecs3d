import assert from "node:assert/strict";
import { WasmRenderer } from "../scripts/system/WasmRenderer.js";

const pixels = new Uint8ClampedArray(4);
let fallbackCamera = null;
const fallback = {
  renderSnapshot(camera) {
    fallbackCamera = camera;
  },
};

const renderer = new WasmRenderer(
  { width: 1, height: 1, imageData: { data: pixels } },
  fallback,
);
const camera = { x: 3, y: 4, angle: 0.5 };
renderer.renderSnapshot(camera);

assert.deepEqual(fallbackCamera, camera);
assert.equal(typeof renderer.updateWorld, "function");
assert.equal(typeof renderer.updateTexture, "function");
assert.equal(typeof renderer.updateCamera, "function");
assert.equal(typeof renderer.updateFrame, "function");
assert.equal(typeof renderer.getFramebuffer, "function");
renderer.destroy();

console.log("PASS WASM renderer adapter contract");
