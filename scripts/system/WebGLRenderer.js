// GPU-native WebGL2 renderer for Raycaster. Unlike SoftwareRenderer/
// WasmRenderer (both CPU: they DDA-trace one ray per screen column, every
// frame, then hand-rasterise walls/planes/sprites into a CPU pixel buffer),
// this renderer builds a real, static 3D mesh from the level's cell grid --
// one quad per wall section face (+ section caps), one quad per cell
// floor/ceiling -- once, at load (and again whenever a cell mutates, see
// updateCellFromState), and simply renders that mesh every frame with a
// standard perspective camera. The GPU rasteriser + a real depth buffer
// resolve visibility; there is no per-frame ray marching in this renderer at
// all. See Docs/raycaster-architecture.md / raycaster-api.md for the level
// format this reads, and this repo's WebGL implementation plan for the
// architectural reasoning (static mesh vs. per-column CPU quads, why pitch
// is a projection shear rather than a real rotation, etc).
//
// Renderer contract (see WasmRenderer.js for the precedent this follows):
// Raycaster.js only ever calls renderSnapshot()/updateWorldFromState()/
// updateCellFromState()/destroy() on this class directly. Every other
// method Raycaster.js needs (createRay, traceRay, checkVisibility support,
// resolveLights, getFogBlend, projectBillboard, ...) is delegated through
// `this.fallback` -- a real SoftwareRenderer instance -- exactly like
// WasmRenderer already does. This renderer never reimplements those; it
// only draws pixels and manages GPU resources.
//
// Camera projection derivation (kept here since the matrix below has no
// other home): Raycaster's existing formulas are
//   screenX = width/2 + lateral*focalLength/depth
//   screenY = (height/2 + pitch) - (worldZ - cameraZ)*focalLength/depth
// where lateral/depth are camera-right/camera-forward axes from a pure yaw
// rotation (camera.pitch is a screen-space pixel shear, NOT a real pitch
// angle -- see raycaster-api.md). Converting screenX/screenY into clip-space
// NDC (ndcX = (screenX-width/2)/(width/2), ndcY = 1-2*screenY/height, using
// clipW = depth so the GPU's perspective divide reproduces the division by
// `depth` above) and solving for a clip-space linear form in
// (lateral, depth, worldZ-cameraZ, 1) gives exactly the matrix built in
// buildViewProjection() below -- same FOV/wall projection/pitch-shear
// behaviour as the CPU renderers, just expressed as a projection matrix
// instead of a per-pixel formula.
import { SoftwareRenderer } from "./SoftwareRenderer.js";

const VERTEX_FLOATS = 9; // position(3) + uv(2) + fogDistance(1) + fogColor(3)
const MAX_LIGHTS = 16;
const NEAR_PLANE = 0.01;
const ALPHA_DISCARD = 0.02;

const SHARED_VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aUV;
layout(location = 2) in float aFogDistance;
layout(location = 3) in vec3 aFogColor;

uniform mat4 uViewProj;

out vec2 vUV;
out vec3 vWorldPos;
out float vFogDistance;
out vec3 vFogColor;

void main() {
  vUV = aUV;
  vWorldPos = aPosition;
  vFogDistance = aFogDistance;
  vFogColor = aFogColor;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

// Shared per-fragment lighting helper text, spliced into both fragment
// shaders below -- same linear falloff as SoftwareRenderer.sampleLightRgb(),
// just evaluated per pixel instead of per-column/per-sprite (a GPU fragment
// gets true per-pixel lighting on every surface "for free", so there's no
// reason to reproduce the CPU's coarser per-column approximation for walls --
// see this repo's WebGL implementation plan).
const LIGHTING_GLSL = `
#define MAX_LIGHTS ${MAX_LIGHTS}
uniform vec3 uCameraPos;
uniform float uAmbient;
uniform int uLightCount;
uniform vec4 uLightPosRadius[MAX_LIGHTS];
uniform vec4 uLightIntensityTint[MAX_LIGHTS];

vec3 sampleLight(vec3 worldPos) {
  vec3 rgb = vec3(uAmbient);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec3 lightPos = uLightPosRadius[i].xyz;
    float radius = uLightPosRadius[i].w;
    vec3 d = worldPos - lightPos;
    float distanceSquared = dot(d, d);
    float radiusSquared = radius * radius;
    if (distanceSquared >= radiusSquared) continue;
    float attenuation = 1.0 - sqrt(distanceSquared) / radius;
    float strength = uLightIntensityTint[i].x * attenuation;
    rgb += strength * uLightIntensityTint[i].yzw;
  }
  return rgb;
}

vec3 applyFog(vec3 color, vec3 worldPos, float fogDistance, vec3 fogColor) {
  if (fogDistance <= 0.0) return color;
  float dist = distance(uCameraPos, worldPos);
  float amount = clamp(dist / fogDistance, 0.0, 1.0);
  return mix(color, fogColor, amount);
}
`;

const GEOMETRY_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vWorldPos;
in float vFogDistance;
in vec3 vFogColor;
out vec4 outColor;

uniform sampler2D uTexture;
${LIGHTING_GLSL}

void main() {
  vec4 texColor = texture(uTexture, vUV);
  vec3 lit = texColor.rgb * sampleLight(vWorldPos);
  lit = applyFog(lit, vWorldPos, vFogDistance, vFogColor);
  outColor = vec4(lit, 1.0);
}
`;

// Sprites reuse the exact same vertex layout/shader as geometry (see
// VERTEX_FLOATS) so both can share one attribute-setup path; only the
// fragment shader differs, by discarding fully-transparent texels --
// matching copySpritePixel()'s "alpha === 0 -> skip the pixel entirely
// (including its depth write)" behaviour.
const SPRITE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vWorldPos;
in float vFogDistance;
in vec3 vFogColor;
out vec4 outColor;

uniform sampler2D uTexture;
${LIGHTING_GLSL}

void main() {
  vec4 texColor = texture(uTexture, vUV);
  if (texColor.a < ${ALPHA_DISCARD}) discard;
  vec3 lit = texColor.rgb * sampleLight(vWorldPos);
  lit = applyFog(lit, vWorldPos, vFogDistance, vFogColor);
  outColor = vec4(lit, texColor.a);
}
`;

// Full-viewport background pass. Inverts the same per-column angle mapping
// createColumnGeometry()/renderSky() use (screenX -> cameraX -> atan(cameraX
// * tan(fov/2)) -> world angle), and the same "stretch to the current
// horizon" vertical mapping -- see SoftwareRenderer.renderSky(). Drawn
// before geometry with depth test/write disabled; discards below the
// horizon so it never overwrites what a floor-less/open area should show
// (matching fillFlatSky()/renderSky() only ever filling rows [0, skyRows)).
const SKY_VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 aClipPos;
out vec2 vScreenUV;

void main() {
  // aClipPos.y: +1 at the top of the screen. vScreenUV.y: 0 at the top,
  // matching pixel-space (top-down) convention used by skyRows below.
  vScreenUV = vec2((aClipPos.x + 1.0) * 0.5, (1.0 - aClipPos.y) * 0.5);
  gl_Position = vec4(aClipPos, 0.0, 1.0);
}
`;

const SKY_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 vScreenUV;
out vec4 outColor;

uniform float uWidth;
uniform float uHeight;
uniform float uSkyRows;
uniform float uCameraAngle;
uniform float uTanHalfFov;
uniform bool uUseTexture;
uniform sampler2D uTexture;
uniform vec3 uFlatColor;

const float TWO_PI = 6.28318530717958647692;

void main() {
  float screenY = vScreenUV.y * uHeight;
  if (screenY >= uSkyRows) discard;

  if (!uUseTexture) {
    outColor = vec4(uFlatColor, 1.0);
    return;
  }

  float screenX = vScreenUV.x * uWidth;
  float cameraX = (screenX - uWidth * 0.5) / (uWidth * 0.5);
  float angleOffset = atan(cameraX * uTanHalfFov);
  float angle = uCameraAngle + angleOffset;
  float normalizedAngle = mod(mod(angle, TWO_PI) + TWO_PI, TWO_PI);
  float u = normalizedAngle / TWO_PI;
  float v = uSkyRows > 0.0 ? screenY / uSkyRows : 0.0;
  outColor = vec4(texture(uTexture, vec2(u, v)).rgb, 1.0);
}
`;

const DEBUG_LINE_VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec3 aPosition;
uniform mat4 uViewProj;
void main() {
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

const DEBUG_LINE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec3 uColor;
void main() {
  outColor = vec4(uColor, 1.0);
}
`;

export class WebGLRenderer {
  constructor(state, fallback) {
    Object.assign(this, state);
    this.defaultFogColor = state.defaultFogColor ?? { r: 70, g: 110, b: 160 };
    this.defaultDebugColor = state.defaultDebugColor ?? {
      r: 255,
      g: 0,
      b: 255,
    };
    this.fallback = fallback;
    // Own stats object, kept shape-compatible with SoftwareRenderer's so
    // Raycaster.getDebugStats() never sees an undefined field, but most
    // CPU-only counters (ddaSteps, wallPixels, ...) simply don't apply to a
    // GPU rasteriser and are always 0 here -- see createDebugStats().
    this.debugStats = this.createDebugStats();
    this.debugFrame = 0;
    // Shared by reference with the fallback SoftwareRenderer so both
    // Raycaster.renderSnapshot()'s immediate `this.renderer.debugStats...`
    // writes and its later `activeRenderer.debugStats` read (activeRenderer
    // = this.renderer.fallback) agree -- see WasmRenderer, which has this
    // same asymmetry but no debugStats object at all (only safe there
    // because real callers always pass `debug: false` for it).
    this.fallback.debugStats = this.debugStats;
    this.fallback.debugFrame = this.debugFrame;

    this.ready = false;
    this.failed = null;
    this.opaqueBatches = [];
    this.textureCache = new Map();
    this.worldState = null;
    this.skyTexture = null;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: true,
      // Safe without this: our draw calls and the Phaser CanvasRenderer's
      // context.drawImage(this.canvas, ...) both run synchronously in the
      // same task, before the browser gets a chance to present/clear the
      // WebGL drawing buffer -- this is the standard "WebGL canvas
      // composited through a 2D context" technique. Needs a real-browser
      // check (see this repo's WebGL implementation plan) -- flip this on
      // if the composited frame ever appears to lag or blank out.
      preserveDrawingBuffer: false,
    });

    if (!this.gl) {
      this.failed = new Error("WebGL2 is not supported in this browser.");
      return;
    }

    try {
      this.initialise();
      this.ready = true;
    } catch (error) {
      this.failed = error;
      this.ready = false;
    }
  }

  createDebugStats() {
    return {
      ddaSteps: 0,
      segments: 0,
      wallSegments: 0,
      wallPixels: 0,
      planePixelsTested: 0,
      planePixelsDrawn: 0,
      visibleIntervalChecks: 0,
      visibleIntervals: 0,
      frameMs: 0,
      traceMs: 0,
      uploadMs: 0,
      drawCalls: 0,
    };
  }

  resetDebugStats() {
    const stats = this.createDebugStats();
    Object.assign(this.debugStats, stats);
  }

  reportDebugStats() {
    if (!this.debug || !this.debugLogEvery) return;
    if (this.debugFrame % this.debugLogEvery !== 0) return;
    console.table({ ...this.debugStats });
  }

  initialise() {
    const gl = this.gl;
    this.geometryProgram = this.createProgram(
      SHARED_VERTEX_SOURCE,
      GEOMETRY_FRAGMENT_SOURCE,
    );
    this.spriteProgram = this.createProgram(
      SHARED_VERTEX_SOURCE,
      SPRITE_FRAGMENT_SOURCE,
    );
    this.skyProgram = this.createProgram(SKY_VERTEX_SOURCE, SKY_FRAGMENT_SOURCE);
    this.debugLineProgram = this.createProgram(
      DEBUG_LINE_VERTEX_SOURCE,
      DEBUG_LINE_FRAGMENT_SOURCE,
    );

    this.skyVao = gl.createVertexArray();
    gl.bindVertexArray(this.skyVao);
    this.skyBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    // Two triangles covering the full [-1, 1] clip-space quad.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Small reusable dynamic buffers -- one draw call's worth of geometry
    // at a time (a sprite quad, or one debug wireframe's line list), so no
    // large scratch allocation is needed up front.
    this.spriteVao = gl.createVertexArray();
    gl.bindVertexArray(this.spriteVao);
    this.spriteBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);
    this.bindGeometryAttributes();
    gl.bindVertexArray(null);

    this.debugLineVao = gl.createVertexArray();
    gl.bindVertexArray(this.debugLineVao);
    this.debugLineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugLineBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);

    if (this.map && this.cells && this.level) {
      this.updateWorldFromState({
        level: this.level,
        map: this.map,
        cells: this.cells,
      });
    }
  }

  bindGeometryAttributes() {
    const gl = this.gl;
    const stride = VERTEX_FLOATS * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 24);
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`WebGLRenderer: shader compile failed: ${info}`);
    }
    return shader;
  }

  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(
      gl.FRAGMENT_SHADER,
      fragmentSource,
    );
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`WebGLRenderer: program link failed: ${info}`);
    }
    return {
      program,
      uniforms: new Map(),
    };
  }

  uniformLocation(programInfo, name) {
    let location = programInfo.uniforms.get(name);
    if (location === undefined) {
      location = this.gl.getUniformLocation(programInfo.program, name);
      programInfo.uniforms.set(name, location);
    }
    return location;
  }

  // Lazily uploads/caches a GL texture for any decoded surface (a cell
  // material, a sprite surface, or the panoramic sky) -- keyed by the
  // surface object's own identity, exactly like Raycaster.js's own
  // materialCache and WasmRenderer.materialIds/spriteTextureIds key by
  // surface identity rather than re-decoding. Persists across mesh
  // rebuilds (door toggles) so an unchanged texture is never re-uploaded.
  ensureTexture(surface) {
    if (!surface) return null;
    let texture = this.textureCache.get(surface);
    if (texture) return texture;
    const gl = this.gl;
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      surface.widthPixels,
      surface.heightPixels,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(surface.pixels),
    );
    // NEAREST + REPEAT to match imageSmoothingEnabled=false (pixel art, no
    // blur) and the CPU renderer's wrap()-based world-space texture tiling
    // -- GL_REPEAT wraps the fractional part of a UV coordinate exactly the
    // way wrap(value, size)/size does.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.textureCache.set(surface, texture);
    return texture;
  }

  // Lazily resolves+uploads a sprite's string `texture` key, mirroring
  // SoftwareRenderer.loadSpriteSurface()'s own decode-and-cache path (the
  // surface object it returns is itself cached by that method, so repeat
  // calls for the same key are cheap and ensureTexture() will hit its own
  // cache for the same surface object on the second+ call).
  resolveSpriteTexture(sprite) {
    const surface = this.loadSpriteSurface?.(sprite.texture);
    if (!surface) return null;
    return { surface, texture: this.ensureTexture(surface) };
  }

  // (Re)builds the entire static mesh + uploads any not-yet-seen textures.
  // Called once at construction and again whenever a cell mutates
  // (setCellSections/setCellBlocking -- see updateCellFromState). Cost is
  // proportional to map size, not frame rate; see this repo's WebGL
  // implementation plan for why a full rebuild (rather than a targeted
  // per-cell patch) is an acceptable, documented simplification for now.
  updateWorldFromState(state) {
    this.worldState = state;
    this.level = state.level;
    this.map = state.map;
    this.cells = state.cells;
    if (!this.ready && !this.gl) return;
    this.buildMeshes();
    this.uploadSky();
  }

  updateCellFromState(_cellId, _cell) {
    if (!this.worldState) return;
    this.buildMeshes();
  }

  uploadSky() {
    this.skyTexture = this.sky ? this.ensureTexture(this.sky) : null;
  }

  destroyBatches() {
    const gl = this.gl;
    for (const batch of this.opaqueBatches) {
      gl.deleteVertexArray(batch.vao);
      gl.deleteBuffer(batch.buffer);
    }
    this.opaqueBatches = [];
  }

  buildMeshes() {
    const gl = this.gl;
    this.destroyBatches();

    const level = this.level;
    const map = this.map;
    const cells = this.cells;
    if (!level || !map || !cells) return;

    const batchData = buildGeometryBatches(level, map, cells, this.cellSize);

    for (const [material, floatArray] of batchData) {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, floatArray, gl.STATIC_DRAW);
      this.bindGeometryAttributes();
      gl.bindVertexArray(null);
      this.opaqueBatches.push({
        texture: this.ensureTexture(material),
        vao,
        buffer,
        vertexCount: floatArray.length / VERTEX_FLOATS,
      });
    }
  }

  // Builds the combined view+projection matrix described in this file's
  // header comment, as a column-major Float32Array(16) ready for
  // uniformMatrix4fv. Built fresh every frame (a handful of trig calls +
  // one 4x4 multiply) -- cheap, and avoids caching correctness pitfalls
  // (see raycaster-architecture.md's "precomputing something that depends
  // on a per-frame value" lesson) since every input here (camera pos/angle/
  // pitch/fov) is a per-frame value.
  buildViewProjection(camera) {
    const angle = camera.angle ?? 0;
    const pitch = camera.pitch ?? 0;
    const fov = camera.fov ?? this.fov;
    const focalLength = this.width / 2 / Math.tan(fov / 2);
    const near = NEAR_PLANE;
    const far = Math.max(near + 1, this.maxDistance ?? 1000);

    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const camX = camera.x ?? 0;
    const camY = camera.y ?? 0;
    const camZ = camera.z ?? this.cameraHeight ?? 0;

    // View: world (x,y,z,1) -> camera-space (lateral, depth, zUp, 1).
    const view = mat4FromRows([
      [-sin, cos, 0, -(-sin * camX + cos * camY)],
      [cos, sin, 0, -(cos * camX + sin * camY)],
      [0, 0, 1, -camZ],
      [0, 0, 0, 1],
    ]);

    const tanHalfFov = Math.tan(fov / 2);
    const a = (far + near) / (far - near);
    const b = (-2 * far * near) / (far - near);
    // Projection: camera-space (lateral, depth, zUp, 1) -> clip space.
    // See this file's header comment for the derivation of the Y row (the
    // pitch-shear term) and the Z row (a standard near/far depth mapping --
    // the CPU renderers have no depth buffer at all, so this is a genuinely
    // GPU-native addition, not a reproduction of anything they do).
    const projection = mat4FromRows([
      [1 / tanHalfFov, 0, 0, 0],
      [0, (-pitch * 2) / this.height, (2 * focalLength) / this.height, 0],
      [0, a, 0, b],
      [0, 1, 0, 0],
    ]);

    return mat4Multiply(projection, view);
  }

  renderSnapshot(camera) {
    // Mirrors WasmRenderer's own graceful-degradation contract: if WebGL2
    // context/shader setup failed (see the constructor's try/catch and the
    // `!this.gl` check), fall back to the real SoftwareRenderer instance,
    // which -- in this case -- Raycaster.js is displaying via the ordinary
    // imageData/putImageData/BitmapData path instead of this renderer's own
    // canvas (see the constructor's renderer-selection block).
    if (!this.ready) {
      this.fallback.renderSnapshot(camera);
      return;
    }
    const gl = this.gl;
    const frameStart = this.debug ? performance.now() : 0;
    this.debugFrame++;
    this.fallback.debugFrame = this.debugFrame;
    if (this.debug) this.resetDebugStats();

    // Reuses the real SoftwareRenderer projection update (fov/focalLength/
    // renderHorizon/planeRowFactors/...) so gameplay code that reads those
    // fields off the Raycaster (e.g. getCameraForwardVector(), weapon aim)
    // keeps seeing live, per-frame-correct values regardless of which
    // renderer is drawing pixels -- see this repo's WebGL implementation
    // plan for why WasmRenderer alone doesn't guarantee this.
    this.fallback.updateProjection(camera);

    const ambient = camera.ambient ?? 1;
    const resolvedLights = this.fallback.resolveLights(camera.lights).slice(
      0,
      MAX_LIGHTS,
    );
    // Kept live every frame (unlike the WASM path, which only ever updates
    // this while its module is still loading) -- see WebGLRenderer's
    // constructor comment. Consumed by CameraRenderer's viewmodel tint via
    // raycaster.sampleLightRgb()/raycaster.lastLighting.
    this.fallback.lastLighting = {
      ambient,
      lights: resolvedLights,
      active: ambient !== 1 || resolvedLights.length > 0,
    };

    const viewProj = this.buildViewProjection(camera);
    const camX = camera.x ?? 0;
    const camY = camera.y ?? 0;
    const camZ = camera.z ?? this.cameraHeight ?? 0;
    // Read by buildSpriteVertices() for billboard orientation -- set here,
    // unconditionally, rather than inside drawSky() (which can return
    // early with nothing to draw, e.g. pitched to look straight down, and
    // must never leave this stale for sprites).
    this.lastCameraAngle = camera.angle ?? 0;

    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.drawSky(camera);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    this.drawOpaqueBatches(viewProj, camX, camY, camZ, ambient, resolvedLights);
    this.drawSprites(camera, viewProj, camX, camY, camZ, ambient, resolvedLights);

    if (camera.debugObjects && camera.debugObjects.length) {
      this.drawDebugWireframes(camera, viewProj);
    }

    if (this.debug) {
      this.debugStats.frameMs = performance.now() - frameStart;
    }
    this.reportDebugStats();
  }

  setLightUniforms(programInfo, camX, camY, camZ, ambient, lights) {
    const gl = this.gl;
    gl.uniform3f(this.uniformLocation(programInfo, "uCameraPos"), camX, camY, camZ);
    gl.uniform1f(this.uniformLocation(programInfo, "uAmbient"), ambient);
    gl.uniform1i(this.uniformLocation(programInfo, "uLightCount"), lights.length);
    if (lights.length) {
      const posRadius = new Float32Array(MAX_LIGHTS * 4);
      const intensityTint = new Float32Array(MAX_LIGHTS * 4);
      for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        posRadius[i * 4] = light.x;
        posRadius[i * 4 + 1] = light.y;
        posRadius[i * 4 + 2] = light.z;
        posRadius[i * 4 + 3] = light.radius;
        intensityTint[i * 4] = light.intensity;
        intensityTint[i * 4 + 1] = light.tintR;
        intensityTint[i * 4 + 2] = light.tintG;
        intensityTint[i * 4 + 3] = light.tintB;
      }
      gl.uniform4fv(
        this.uniformLocation(programInfo, "uLightPosRadius[0]"),
        posRadius,
      );
      gl.uniform4fv(
        this.uniformLocation(programInfo, "uLightIntensityTint[0]"),
        intensityTint,
      );
    }
  }

  drawOpaqueBatches(viewProj, camX, camY, camZ, ambient, lights) {
    if (!this.opaqueBatches.length) return;
    const gl = this.gl;
    const programInfo = this.geometryProgram;
    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(this.uniformLocation(programInfo, "uViewProj"), false, viewProj);
    this.setLightUniforms(programInfo, camX, camY, camZ, ambient, lights);
    gl.uniform1i(this.uniformLocation(programInfo, "uTexture"), 0);
    gl.activeTexture(gl.TEXTURE0);

    for (const batch of this.opaqueBatches) {
      if (!batch.texture || !batch.vertexCount) continue;
      gl.bindTexture(gl.TEXTURE_2D, batch.texture);
      gl.bindVertexArray(batch.vao);
      gl.drawArrays(gl.TRIANGLES, 0, batch.vertexCount);
      if (this.debug) this.debugStats.drawCalls++;
    }
    gl.bindVertexArray(null);
  }

  // Per-frame sprite quads (billboard: screen-facing via the camera-right
  // axis, same lateral/world-Z anchoring as projectBillboard(); oriented:
  // the sprite's own fixed world-space left/right edge, same as
  // renderOrientedSprite()). Built and uploaded per sprite -- sprite counts
  // here are small (tens, not thousands), so a per-sprite draw call stays
  // well clear of the "thousands of draw calls" failure mode while keeping
  // back-to-front alpha blending trivially correct via CPU sort, same as
  // SoftwareRenderer.renderSprites().
  drawSprites(camera, viewProj, camX, camY, camZ, ambient, lights) {
    const sprites = camera.sprites;
    if (!sprites || !sprites.length) return;
    const gl = this.gl;

    const ordered = sprites
      .filter((sprite) => sprite && sprite.texture)
      .map((sprite) => ({
        sprite,
        depth: this.fallback.getSpriteCameraSpace(camera, sprite).depth,
      }))
      .filter(({ depth }) => depth > 0.0001)
      .sort((a, b) => b.depth - a.depth);

    if (!ordered.length) return;

    const programInfo = this.spriteProgram;
    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(this.uniformLocation(programInfo, "uViewProj"), false, viewProj);
    this.setLightUniforms(programInfo, camX, camY, camZ, ambient, lights);
    gl.uniform1i(this.uniformLocation(programInfo, "uTexture"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.spriteVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);

    for (const { sprite } of ordered) {
      const resolved = this.resolveSpriteTexture(sprite);
      if (!resolved) continue;
      const vertices = this.buildSpriteVertices(sprite);
      if (!vertices) continue;
      gl.bindTexture(gl.TEXTURE_2D, resolved.texture);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (this.debug) this.debugStats.drawCalls++;
    }

    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  buildSpriteVertices(sprite) {
    const size = this.getBillboardWorldSizeFor(sprite);
    const worldWidth = size.width;
    const worldHeight = size.height;
    const z = sprite.z ?? 0;
    const top = z + worldHeight;
    const spriteCell = this.fallback.getCell(
      sprite.x / this.cellSize,
      sprite.y / this.cellSize,
    );
    const fog = spriteCell?.fog;
    const fogDistance = fog?.distance ?? 0;
    const fogR = fog?.color?.r ?? 0;
    const fogG = fog?.color?.g ?? 0;
    const fogB = fog?.color?.b ?? 0;
    const halfWidth = worldWidth / 2;

    // The sprite's world-space horizontal axis: for an oriented sprite it's
    // fixed (perpendicular to sprite.angle, the direction the front face
    // points -- same as renderOrientedSprite()); for a billboard it's the
    // camera-right axis every frame (a cylindrical billboard -- it only
    // rotates around world Z to face the camera, never tilts with pitch,
    // matching projectBillboard()'s screen-space rectangle exactly).
    const axisAngle =
      sprite.billboard === false ? (sprite.angle ?? 0) : (this.lastCameraAngle ?? 0);
    const axisX = -Math.sin(axisAngle);
    const axisY = Math.cos(axisAngle);
    const leftX = sprite.x - axisX * halfWidth;
    const leftY = sprite.y - axisY * halfWidth;
    const rightX = sprite.x + axisX * halfWidth;
    const rightY = sprite.y + axisY * halfWidth;

    return this.spriteQuadFloats(
      leftX,
      leftY,
      rightX,
      rightY,
      z,
      top,
      fogDistance,
      fogR,
      fogG,
      fogB,
    );
  }

  // u=0 at the left edge, u=1 at the right edge; v=0 at the top of the
  // texture (worldZ = top), v=1 at the bottom (worldZ = z) -- matches the
  // image decode's row-0-is-top convention. If a real texture/sprite ever
  // appears mirrored or vertically flipped once checked in-browser, swap
  // the corresponding u/v pair below -- purely cosmetic, no structural
  // effect on lighting/fog/depth.
  spriteQuadFloats(leftX, leftY, rightX, rightY, bottom, top, fogDistance, fogR, fogG, fogB) {
    const verts = [
      [leftX, leftY, bottom, 0, 1],
      [rightX, rightY, bottom, 1, 1],
      [rightX, rightY, top, 1, 0],
      [leftX, leftY, top, 0, 0],
    ];
    const out = new Float32Array(6 * VERTEX_FLOATS);
    let offset = 0;
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z, u, v] = verts[index];
      out[offset++] = x;
      out[offset++] = y;
      out[offset++] = z;
      out[offset++] = u;
      out[offset++] = v;
      out[offset++] = fogDistance;
      out[offset++] = fogR;
      out[offset++] = fogG;
      out[offset++] = fogB;
    }
    return out;
  }

  getBillboardWorldSizeFor(sprite) {
    const scale = sprite.scale ?? 1;
    const scaleX = typeof scale === "number" ? scale : (scale.x ?? 1);
    const scaleY = typeof scale === "number" ? scale : (scale.y ?? scaleX);
    const width = sprite.width ?? sprite.billboardWidth ?? 1;
    const height = sprite.height ?? sprite.billboardHeight ?? width;
    return { width: width * scaleX, height: height * scaleY };
  }

  drawSky(camera) {
    const gl = this.gl;
    const pitch = camera.pitch ?? 0;
    const skyRows = Math.max(0, Math.min(this.height, Math.ceil(this.height / 2 + pitch)));
    if (skyRows <= 0) return;
    const fov = camera.fov ?? this.fov;

    const programInfo = this.skyProgram;
    gl.useProgram(programInfo.program);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.uniform1f(this.uniformLocation(programInfo, "uWidth"), this.width);
    gl.uniform1f(this.uniformLocation(programInfo, "uHeight"), this.height);
    gl.uniform1f(this.uniformLocation(programInfo, "uSkyRows"), skyRows);
    gl.uniform1f(this.uniformLocation(programInfo, "uCameraAngle"), camera.angle ?? 0);
    gl.uniform1f(this.uniformLocation(programInfo, "uTanHalfFov"), Math.tan(fov / 2));

    const sky = this.defaultFogColor;
    gl.uniform3f(this.uniformLocation(programInfo, "uFlatColor"), sky.r / 255, sky.g / 255, sky.b / 255);
    if (this.skyTexture) {
      gl.uniform1i(this.uniformLocation(programInfo, "uUseTexture"), 1);
      gl.uniform1i(this.uniformLocation(programInfo, "uTexture"), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.skyTexture);
    } else {
      gl.uniform1i(this.uniformLocation(programInfo, "uUseTexture"), 0);
    }

    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.depthMask(true);
  }

  // Debug-only overlays (sprite anchors, collision wireframes) drawn as
  // native GL lines using the same view/projection matrix as everything
  // else, reusing renderDebugCylinder()'s world-space ring/edge math via
  // the fallback -- avoids the WASM path's CPU-readback-and-poke trick
  // entirely (see WasmRenderer.drawDebugOverlays()), since nothing here
  // needs to touch a CPU pixel buffer.
  drawDebugWireframes(camera, viewProj) {
    const gl = this.gl;
    const programInfo = this.debugLineProgram;
    const color = this.defaultDebugColor;
    const lines = [];
    for (const wireframe of camera.debugObjects) {
      collectDebugCylinderLines(wireframe, lines);
    }
    if (!lines.length) return;

    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(this.uniformLocation(programInfo, "uViewProj"), false, viewProj);
    gl.uniform3f(
      this.uniformLocation(programInfo, "uColor"),
      color.r / 255,
      color.g / 255,
      color.b / 255,
    );
    gl.bindVertexArray(this.debugLineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.debugLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.LINES, 0, lines.length / 3);
    gl.bindVertexArray(null);
    if (this.debug) this.debugStats.drawCalls++;
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    this.destroyBatches();
    for (const texture of this.textureCache.values()) gl.deleteTexture(texture);
    this.textureCache.clear();
    for (const info of [
      this.geometryProgram,
      this.spriteProgram,
      this.skyProgram,
      this.debugLineProgram,
    ]) {
      if (info) gl.deleteProgram(info.program);
    }
    for (const buffer of [this.skyBuffer, this.spriteBuffer, this.debugLineBuffer]) {
      if (buffer) gl.deleteBuffer(buffer);
    }
    for (const vao of [this.skyVao, this.spriteVao, this.debugLineVao]) {
      if (vao) gl.deleteVertexArray(vao);
    }
    this.gl = null;
    this.canvas = null;
    this.ready = false;
  }
}

// Approximates a cylinder the same way SoftwareRenderer.renderDebugCylinder
// does (a ring of vertical edges plus top/bottom rings), but emits raw
// world-space line-segment endpoint triples instead of drawing pixels --
// consumed by drawDebugWireframes() above via gl.LINES.
function collectDebugCylinderLines(wireframe, out) {
  const {
    x,
    y,
    z = 0,
    radius = 8,
    height = 8,
    segments = 8,
  } = wireframe;
  const bottom = z;
  const top = z + height;
  const ring = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    ring.push([x + Math.cos(theta) * radius, y + Math.sin(theta) * radius]);
  }
  for (let i = 0; i < segments; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % segments];
    out.push(ax, ay, bottom, bx, by, bottom);
    out.push(ax, ay, top, bx, by, top);
    out.push(ax, ay, bottom, ax, ay, top);
  }
}

// Builds a column-major Float32Array(16) from 16 values given in natural
// row-major reading order (rows[r][c]) -- lets buildViewProjection() above
// read exactly like the row equations it's derived from, while producing
// data in the layout uniformMatrix4fv(..., false, data) expects.
function mat4FromRows(rows) {
  const out = new Float32Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[c * 4 + r] = rows[r][c];
    }
  }
  return out;
}

// Column-major 4x4 multiply: returns a * b (applies b first, then a) --
// used to combine the projection and view matrices into one.
function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k];
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

// Pure geometry-building step, deliberately kept free of any `gl` calls so
// it's directly unit-testable under Node (no WebGL context needed) -- see
// tests/webgl-renderer-contract.test.mjs. Walks the level's cell grid the
// same way WasmRenderer.updateWorldFromState() walks it for its packed
// buffers, but emits vertex data (position/uv/fog -- see VERTEX_FLOATS)
// grouped by material object identity instead of packing into native
// records. One quad per wall-section face (+ section caps, matching
// drawSectionCaps()'s neighbour logic) and one quad per cell floor/ceiling
// -- see this file's header comment and this repo's WebGL implementation
// plan for why this (a static mesh) rather than per-column CPU quads.
// Returns Map<material-or-surface-object, Float32Array>.
export function buildGeometryBatches(level, map, cells, cellSize) {
  const batchLists = new Map();
  const emitQuad = (material, corners, uvs, fog) => {
    if (!material) return;
    let list = batchLists.get(material);
    if (!list) {
      list = [];
      batchLists.set(material, list);
    }
    const fogDistance = fog?.distance ?? 0;
    const fogR = fog?.color?.r ?? 0;
    const fogG = fog?.color?.g ?? 0;
    const fogB = fog?.color?.b ?? 0;
    // Two triangles: (0,1,2) and (0,2,3). Winding doesn't matter -- face
    // culling is disabled (see WebGLRenderer.initialise()) to avoid
    // winding-order bugs across the many face orientations generated below.
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const [x, y, z] = corners[index];
      const [u, v] = uvs[index];
      list.push(x, y, z, u, v, fogDistance, fogR, fogG, fogB);
    }
  };

  const floorCeilingQuad = (x0, y0, x1, y1, z, material, fog) => {
    if (!material) return;
    const mw = material.width || cellSize;
    const mh = material.height || cellSize;
    emitQuad(
      material,
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      [
        [x0 / mw, y0 / mh],
        [x1 / mw, y0 / mh],
        [x1 / mw, y1 / mh],
        [x0 / mw, y1 / mh],
      ],
      fog,
    );
  };

  // Cap faces (a section's sill top / lintel underside) are horizontal
  // planes scoped to one section's material/height, same footprint as a
  // floor/ceiling tile -- mirrors drawSectionCaps()'s reuse of
  // renderPlane() rather than inventing new geometry, so this just reuses
  // floorCeilingQuad() with the section's own material/height.
  const capQuad = floorCeilingQuad;

  // Faces perpendicular to X (east/west) use world Y for texture U --
  // matches drawWallSection() picking entryHitY when a ray crosses a
  // vertical (side === 0) grid line.
  const wallFaceX = (xConst, y0, y1, zBottom, zTop, material, fog) => {
    const mw = material.width || cellSize;
    const mh = material.height || cellSize;
    const vBottom = 0;
    const vTop = (zTop - zBottom) / mh;
    emitQuad(
      material,
      [
        [xConst, y0, zBottom],
        [xConst, y1, zBottom],
        [xConst, y1, zTop],
        [xConst, y0, zTop],
      ],
      [
        [y0 / mw, vBottom],
        [y1 / mw, vBottom],
        [y1 / mw, vTop],
        [y0 / mw, vTop],
      ],
      fog,
    );
  };

  // Faces perpendicular to Y (north/south) use world X for texture U --
  // matches drawWallSection() picking entryHitX for side === 1.
  const wallFaceY = (yConst, x0, x1, zBottom, zTop, material, fog) => {
    const mw = material.width || cellSize;
    const mh = material.height || cellSize;
    const vBottom = 0;
    const vTop = (zTop - zBottom) / mh;
    emitQuad(
      material,
      [
        [x0, yConst, zBottom],
        [x1, yConst, zBottom],
        [x1, yConst, zTop],
        [x0, yConst, zTop],
      ],
      [
        [x0 / mw, vBottom],
        [x1 / mw, vBottom],
        [x1 / mw, vTop],
        [x0 / mw, vTop],
      ],
      fog,
    );
  };

  for (let cy = 0; cy < level.height; cy++) {
    const row = map[cy] ?? [];
    for (let cx = 0; cx < level.width; cx++) {
      const id = String(row[cx] ?? "1");
      const cell = cells[id] ?? cells["0"];
      if (!cell) continue;
      const x0 = cx * cellSize;
      const x1 = x0 + cellSize;
      const y0 = cy * cellSize;
      const y1 = y0 + cellSize;

      if (cell.floor) {
        floorCeilingQuad(x0, y0, x1, y1, cell.floorHeight, cell.floor, cell.fog);
      }
      if (cell.ceiling) {
        floorCeilingQuad(x0, y0, x1, y1, cell.ceilingHeight, cell.ceiling, cell.fog);
      }

      const sections = cell.sections ?? [];
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (!section.material) continue;
        const { bottom, top, material } = section;
        if (top <= bottom) continue;
        const fog = cell.fog;

        // All four side faces are emitted unconditionally for every
        // section-bearing cell, even ones that border another equally
        // solid neighbour (an interior face the camera can never reach).
        // This is a deliberate, documented simplification -- reasoning
        // about which faces are externally visible would need the same
        // neighbour-gap interval logic subtractInterval()/
        // drawSectionCaps() already do on the CPU side, and for the
        // modest, mostly-single-cell-thick levels this engine uses the
        // extra hidden triangles are a bounded, minor cost. See this
        // repo's WebGL implementation plan.
        wallFaceX(x0, y0, y1, bottom, top, material, fog);
        wallFaceX(x1, y0, y1, bottom, top, material, fog);
        wallFaceY(y0, x0, x1, bottom, top, material, fog);
        wallFaceY(y1, x0, x1, bottom, top, material, fog);

        const ceilingBound =
          i + 1 < sections.length ? sections[i + 1].bottom : cell.ceilingHeight;
        if (top < ceilingBound) {
          capQuad(x0, y0, x1, y1, top, material, fog);
        }
        const floorBound = i > 0 ? sections[i - 1].top : cell.floorHeight;
        if (bottom > floorBound) {
          capQuad(x0, y0, x1, y1, bottom, material, fog);
        }
      }
    }
  }

  const batches = new Map();
  for (const [material, list] of batchLists) {
    batches.set(material, new Float32Array(list));
  }
  return batches;
}
