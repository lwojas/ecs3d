// Projection invariants shared by every ray/plane/billboard calculation below.
// `fov` is always the HORIZONTAL field of view, so every horizontal quantity
// (focalLength, columnGeometry, billboard screenX) is derived from `width`.
//
//   focalLength = width / 2 / tan(fov / 2)
//   screenX     = width / 2 + cameraX * focalLength / depth        (projectLateralToScreenX)
//   screenY     = renderHorizon - (worldZ - cameraZ) * focalLength / depth   (projectWorldZ)
//
// Walls/planes reach the same screenX relationship implicitly: each screen
// column is pre-assigned a ray angle in createColumnGeometry() (also
// width-derived), and DDA finds the world distance for that exact column
// instead of projecting a world position forward. Sprites do not ray-cast,
// so projectLateralToScreenX() performs the forward projection explicitly.
// Both paths are algebraically the same relationship and must stay in sync
// whenever `focalLength` or `fov` changes — see computeFocalLength().
//
// `depth`/`distance` below is the corrected, camera-forward-axis distance
// (perpendicular to the camera plane), never raw Euclidean/ray distance,
// unless a name explicitly says "ray" (e.g. rayDistance, entryDistance).
import { SoftwareRenderer } from "./SoftwareRenderer.js";
import { WasmRenderer } from "./WasmRenderer.js";

export class Raycaster {
  // Distance fog's built-in fallback colour matches the flat sky colour
  // (fillFlatSky() below) -- unconfigured fog blending toward the
  // horizon colour is the conventional, natural-looking default.
  static DEFAULT_FOG_COLOR = { r: 70, g: 110, b: 160 };
  static DEFAULT_DEBUG_COLOR = { r: 255, g: 0, b: 255 };

  constructor(game, level, options = {}) {
    this.game = game;
    this.level = level;
    this.width = options.width || 320;
    this.height = options.height || 180;
    this.cellSize = options.cellSize || 4;
    this.wallHeight = options.wallHeight || 2.5;
    this.cameraHeight =
      options.cameraHeight !== undefined
        ? options.cameraHeight
        : this.wallHeight / 2;
    this.fov = options.fov || Math.PI / 3;
    this.maxDistance =
      options.maxDistance ||
      Math.max(level.width, level.height) * this.cellSize;
    this.focalLength = this.computeFocalLength(this.fov);
    this.columnGeometry = this.createColumnGeometry();
    this.renderCameraHeight = this.cameraHeight;
    this.renderHorizon = this.height / 2;
    this.planeRowFactors = this.createPlaneRowFactors(
      this.focalLength,
      this.renderHorizon,
    );
    this.segmentScratch = Array.from({ length: this.width }, () => []);
    this.visibleIntervalCapacity = options.visibleIntervalCapacity || 8;
    this.visibleIntervalScratch = Array.from(
      { length: this.width },
      () => new Float64Array(this.visibleIntervalCapacity * 2),
    );
    this.columnDepth = new Float32Array(this.width);
    this.columnDepth.fill(Infinity);
    this.pixelDepth = new Float32Array(this.width * this.height);
    this.pixelDepth.fill(Infinity);
    // Reused across frames by renderSky() so mapping a texture row to a
    // screen row isn't recomputed once per column -- see renderSky().
    this.skyRowScratch = new Int32Array(this.height);
    this.debug = options.debug === true;
    this.debugSpriteAnchors = options.debugSpriteAnchors === true;
    this.debugLogEvery = options.debugLogEvery || 0;
    this.debugFrame = 0;
    this.debugStats = this.createDebugStats();

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.imageData = this.ctx.createImageData(this.width, this.height);

    this.sprite = this.game.add.sprite(0, 0, null);
    this.texture = this.game.add.bitmapData(this.width, this.height);
    this.sprite.loadTexture(this.texture);
    this.sprite.smoothed = false;

    this.cells = {};
    this.materialCache = Object.create(null);
    this.materialCacheHits = 0;
    this.materialCacheMisses = 0;
    this.map = this.normaliseMap(level.map);
    this.loadCells();
    // Optional level-wide panoramic sky (level.sky = {texture}). Loaded
    // once, the same way cell surfaces are -- separate from cell
    // geometry, collision, and depth rendering (see renderSky()). `null`
    // when unconfigured, which keeps the existing flat-colour background
    // path unchanged.
    this.sky = this.loadSurface(level.sky ?? null);
    const rendererState = {
      width: this.width,
      height: this.height,
      cellSize: this.cellSize,
      cameraHeight: this.cameraHeight,
      fov: this.fov,
      maxDistance: this.maxDistance,
      level: this.level,
      map: this.map,
      cells: this.cells,
      columnGeometry: this.columnGeometry,
      focalLength: this.focalLength,
      renderCameraHeight: this.renderCameraHeight,
      renderHorizon: this.renderHorizon,
      planeRowFactors: this.planeRowFactors,
      segmentScratch: this.segmentScratch,
      visibleIntervalCapacity: this.visibleIntervalCapacity,
      visibleIntervalScratch: this.visibleIntervalScratch,
      columnDepth: this.columnDepth,
      pixelDepth: this.pixelDepth,
      skyRowScratch: this.skyRowScratch,
      debug: this.debug,
      debugSpriteAnchors: this.debugSpriteAnchors,
      debugLogEvery: this.debugLogEvery,
      debugFrame: this.debugFrame,
      debugStats: this.debugStats,
      imageData: this.imageData,
      sky: this.sky,
      defaultFogColor: Raycaster.DEFAULT_FOG_COLOR,
      defaultDebugColor: Raycaster.DEFAULT_DEBUG_COLOR,
      loadSpriteSurface: this.loadSpriteSurface.bind(this),
    };
    const softwareRenderer = new SoftwareRenderer(rendererState);
    this.renderer =
      options.renderer === "wasm"
        ? new WasmRenderer(rendererState, softwareRenderer)
        : softwareRenderer;
    this.renderer.updateWorldFromState?.({
      level: this.level,
      map: this.map,
      cells: this.cells,
    });
  }

  normaliseMap(map) {
    return (map || []).map((row) =>
      typeof row === "string" ? row.split("") : Array.from(row || [], String),
    );
  }

  normaliseCellDefinition(definition = {}) {
    const wall = definition.wall ?? null;
    const floorHeight =
      definition.floorHeight ?? this.level.defaultFloorHeight ?? 0;
    const ceilingHeight =
      definition.ceilingHeight ??
      this.level.defaultCeilingHeight ??
      this.wallHeight;
    // A cell boundary is either one ordinary full-height wall (`wall`) or a
    // railings, overhangs, or (eventually) doors -- see
    // raycaster-architecture.md. `sections` wins if both are given; `wall`
    // is sugar for a single section spanning the whole cell, so ordinary
    // walls cost nothing extra to render (see drawWallSection()).
    // Sorted bottom-to-top once here (not per frame) so the renderer can
    // find each section's neighbours -- and therefore its cap faces, see
    // drawSectionCaps() -- by simply looking at sections[i - 1]/[i + 1].
    const sections = (
      definition.sections
        ? definition.sections.map((section) => ({
            bottom: section.bottom ?? floorHeight,
            top: section.top ?? ceilingHeight,
            material: section.material ?? null,
          }))
        : wall
          ? [{ bottom: floorHeight, top: ceilingHeight, material: wall }]
          : []
    ).sort((a, b) => a.bottom - b.bottom);
    return {
      floorHeight,
      ceilingHeight,
      wall,
      sections,
      floor: definition.floor ?? null,
      ceiling: definition.ceiling ?? null,
      // `sections` controls rendering vertical faces; `blocking` controls
      // movement collision. They default together (any section blocks) so
      // existing levels are unaffected, but a level can set `blocking:
      // false` on a low wall/curb cell to make it a walkable step while
      // still rendering its riser face.
      blocking: definition.blocking ?? sections.length > 0,
      // A fog "zone" is just whichever cells set `fog`. `fog: true` is a
      // shorthand for the level (or built-in) defaults; `fog: {distance,
      // color}` overrides either independently. No fog on a cell (the
      // default) costs nothing at render time -- see getFogBlend().
      fog: definition.fog
        ? {
            distance:
              definition.fog.distance ?? this.level.defaultFogDistance ?? 20,
            color:
              definition.fog.color ??
              this.level.defaultFogColor ??
              Raycaster.DEFAULT_FOG_COLOR,
          }
        : null,
    };
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
    };
  }

  resetDebugStats() {
    this.debugStats = this.createDebugStats();
  }

  getDebugStats() {
    return { ...(this.renderer?.debugStats ?? this.debugStats) };
  }

  getMaterialStats() {
    return {
      entries: Object.keys(this.materialCache).length,
      hits: this.materialCacheHits,
      misses: this.materialCacheMisses,
    };
  }

  resetColumnDepth() {
    const renderer = this.renderer?.fallback ?? this.renderer;
    if (renderer) renderer.resetColumnDepth();
    else {
      this.columnDepth.fill(Infinity);
      this.pixelDepth.fill(Infinity);
    }
  }

  getColumnDepth(screenX) {
    return this.columnDepth[screenX];
  }

  createCameraSnapshot(player) {
    return {
      x: player.x,
      y: player.y,
      z: player.z ?? this.cameraHeight,
      angle: player.angle,
      pitch: player.pitch ?? 0,
      fov: player.fov ?? this.fov,
    };
  }

  reportDebugStats() {
    if (!this.debug || !this.debugLogEvery) return;
    if (this.debugFrame % this.debugLogEvery !== 0) return;
    console.table(this.getDebugStats());
  }

  // Sole source of `focalLength`. `fov` is horizontal, so this must always
  // derive from `width`, never `height` — see the class-level projection
  // comment. Called from the constructor and updateProjection() so the two
  // never drift apart again.
  computeFocalLength(fov = this.fov) {
    return this.width / 2 / Math.tan(fov / 2);
  }

  createColumnGeometry(fov = this.fov) {
    const geometry = new Array(this.width);
    const halfWidth = this.width / 2;
    const fovScale = Math.tan(fov / 2);

    for (let screenX = 0; screenX < this.width; screenX++) {
      const cameraX = (screenX - halfWidth) / halfWidth;
      const angleOffset = Math.atan(cameraX * fovScale);
      geometry[screenX] = {
        angleOffset,
        sin: Math.sin(angleOffset),
        cos: Math.cos(angleOffset),
        rayCos: Math.cos(angleOffset),
      };
    }

    return geometry;
  }

  createPlaneRowFactors(
    focalLength = this.focalLength,
    horizon = this.height / 2,
  ) {
    const factors = new Float64Array(this.height);

    for (let screenY = 0; screenY < this.height; screenY++) {
      const offset = screenY - horizon;
      factors[screenY] =
        Math.abs(offset) < 0.000001 ? Infinity : focalLength / offset;
    }

    return factors;
  }

  loadCells() {
    const definitions = this.level.cells || {};
    for (const id in definitions) {
      const definition = this.normaliseCellDefinition(definitions[id]);
      this.cells[id] = {
        floorHeight: definition.floorHeight,
        ceilingHeight: definition.ceilingHeight,
        // `wall` is kept for informational/back-compat introspection only
        // (e.g. a quick "does this cell have an ordinary wall" check) --
        // rendering and collision read `sections`, the authoritative list,
        // exclusively. See normaliseCellDefinition().
        wall: this.loadSurface(definition.wall),
        sections: definition.sections.map((section) => ({
          bottom: section.bottom,
          top: section.top,
          material: this.loadSurface(section.material),
        })),
        floor: this.loadSurface(definition.floor),
        ceiling: this.loadSurface(definition.ceiling),
        blocking: definition.blocking,
        fog: definition.fog,
      };
    }
  }

  loadSurface(surface) {
    surface = this.resolveSurface(surface);
    if (!surface || !surface.texture) return null;

    const width = surface.width || this.cellSize;
    const height = surface.height || this.cellSize;
    const cacheKey = `${surface.texture}:${width}:${height}`;
    const cached = this.materialCache[cacheKey];

    if (cached) {
      this.materialCacheHits++;
      return cached;
    }

    this.materialCacheMisses++;
    const image = this.game.cache.getImage(surface.texture);
    if (!image) {
      console.warn(`Raycaster: texture "${surface.texture}" not found.`);
      return null;
    }
    const imageData = this.decodeImagePixels(image);
    const material = {
      textureKey: surface.texture,
      width,
      height,
      widthPixels: image.width,
      heightPixels: image.height,
      pixels: imageData.data,
    };

    this.materialCache[cacheKey] = material;
    return material;
  }

  // Shared CPU-readable pixel decode used by both cell materials and sprite
  // surfaces so both caches read from the same canvas-decoding path.
  decodeImagePixels(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.width, image.height);
  }

  resolveSurface(surface) {
    if (!surface) return null;

    const materials = this.level.materials || {};
    if (typeof surface === "string") {
      return materials[surface] || null;
    }

    if (surface.material) {
      const material = materials[surface.material];
      if (!material) return surface;
      return { ...material, ...surface };
    }

    return surface;
  }

  loadSpriteSurface(texture) {
    if (typeof texture !== "string") return texture || null;
    const cacheKey = `sprite:${texture}`;
    const cached = this.materialCache[cacheKey];
    if (cached) return cached;
    const image = this.game.cache.getImage(texture);
    if (!image) {
      console.warn(`Raycaster: sprite texture "${texture}" not found.`);
      return null;
    }
    const imageData = this.decodeImagePixels(image);
    const surface = {
      textureKey: texture,
      width: 1,
      height: 1,
      widthPixels: image.width,
      heightPixels: image.height,
      pixels: imageData.data,
    };
    this.materialCache[cacheKey] = surface;
    return surface;
  }

  isInsideMap(mapX, mapY) {
    return (
      mapX >= 0 &&
      mapY >= 0 &&
      mapX < this.level.width &&
      mapY < this.level.height
    );
  }

  getCellId(x, y) {
    const mapX = Math.floor(x);
    const mapY = Math.floor(y);
    if (!this.isInsideMap(mapX, mapY)) return "1";
    return String(this.map[mapY][mapX]);
  }

  getCell(x, y) {
    const id =
      Number.isInteger(x) && Number.isInteger(y)
        ? this.isInsideMap(x, y)
          ? String(this.map[y][x])
          : "1"
        : this.getCellId(x, y);
    return this.cells[id] || this.cells["0"];
  }

  // Runtime cell mutation for gameplay-driven geometry/collision changes
  // (doors, switches). Both setters key by cell **id** (as it appears in
  // the map, e.g. "5"), not by an (x, y) position: every map tile that
  // shares an id shares the exact same cell object, so mutating it
  // affects every tile using that id at once. Give each door its own
  // unique id if it should open independently of others.
  //
  // Every read path (isWallWorld, getStandingHeight, renderColumn,
  // checkVisibility, ...) re-reads the cell fresh each call -- nothing
  // about a cell is cached or snapshotted at load time -- so a change
  // made here is visible on the very next render/query, no separate
  // "apply" or "rebuild" step required.

  // Sets a cell's `sections` from the same raw shape used when authoring
  // a level (`[{bottom, top, material}, ...]`, heights optional and
  // defaulting from the cell's current floorHeight/ceilingHeight,
  // `material` a string/inline-object/material-reference surface, not a
  // pre-loaded one) -- resolves and sorts them exactly like
  // normaliseCellDefinition()/loadCells() do at level load. Does not
  // touch `blocking`; call setCellBlocking() separately if a door's
  // openness should also change whether it blocks movement -- the
  // Raycaster doesn't decide that relationship for you.
  setCellSections(id, sections) {
    const cell = this.cells[String(id)];
    if (!cell) {
      console.warn(`Raycaster: setCellSections() unknown cell id "${id}".`);
      return null;
    }
    cell.sections = (sections ?? [])
      .map((section) => ({
        bottom: section.bottom ?? cell.floorHeight,
        top: section.top ?? cell.ceilingHeight,
        material: this.loadSurface(section.material ?? null),
      }))
      .sort((a, b) => a.bottom - b.bottom);
    this.renderer?.updateCellFromState?.(Number(id), cell);
    return cell;
  }

  // Sets a cell's movement-blocking flag directly, independent of its
  // `sections` -- see setCellSections() above.
  setCellBlocking(id, blocking) {
    const cell = this.cells[String(id)];
    if (!cell) {
      console.warn(`Raycaster: setCellBlocking() unknown cell id "${id}".`);
      return null;
    }
    cell.blocking = !!blocking;
    this.renderer?.updateCellFromState?.(Number(id), cell);
    return cell;
  }

  // Movement-blocking check. Driven by the cell's configurable `blocking`
  // flag, not by whether it renders a wall face (`cell.wall`) — a cell can
  // have a wall texture and still be non-blocking (a step/curb).
  isWall(x, y) {
    return !!this.getCell(x, y)?.blocking;
  }

  isWallWorld(x, y) {
    return this.isWall(x / this.cellSize, y / this.cellSize);
  }

  // The inverse of the `x / this.cellSize` conversion used throughout this
  // file -- cell-space (possibly fractional, e.g. 7.5 for the middle of
  // cell 7) to world-space. Authored spawn points are stored in cell
  // space so they keep resolving correctly if `cellSize` changes; nothing
  // outside the raycaster should reimplement this multiplication.
  cellToWorld(cellX, cellY) {
    return {
      x: cellX * this.cellSize,
      y: cellY * this.cellSize,
    };
  }

  // The height a standing entity would rest on in this cell, for callers
  // that want to raise/lower camera/entity Z when moving across cells (e.g.
  // camera.z = raycaster.getEyeHeightWorld(player.x, player.y)).
  //
  // A non-blocking cell that still has wall geometry (`sections`) is a
  // walkable step or block (see normaliseCellDefinition()): its standing
  // surface is the top of the cell, `ceilingHeight`, not its base. This is
  // a coarse, whole-cell approximation -- it does not reason about which
  // specific section an entity is under/on for multi-section geometry
  // (windows, overhangs); that judgement belongs to the collision layer,
  // which can inspect `cell.sections` directly. An open cell (no
  // sections, or a blocking one an entity could never be standing in)
  // rests on its `floorHeight`.
  getStandingHeight(x, y) {
    const cell = this.getCell(x, y);
    if (!cell) return 0;
    if ((cell.sections ?? []).length && !cell.blocking)
      return cell.ceilingHeight;
    return cell.floorHeight;
  }

  getStandingHeightWorld(x, y) {
    return this.getStandingHeight(x / this.cellSize, y / this.cellSize);
  }

  // Convenience combining getStandingHeightWorld() with the configured eye
  // offset, so callers can set an entity's world Z in one call instead of
  // re-deriving the eye-height convention themselves.
  getEyeHeightWorld(x, y) {
    return this.getStandingHeightWorld(x, y) + this.cameraHeight;
  }

  // A true 3D aim/forward direction (unit vector) for gameplay callers
  // that need real vertical aim -- projectiles, hitscan, AI aim -- as
  // opposed to `camera.pitch`, which is a screen-space horizon shift in
  // pixels for the renderer's 2.5D "look up/down" trick and is never a
  // real rotation (see raycaster-api.md's Rendering section: "Does not
  // affect ray tracing, only where the horizon line sits on screen"). Do
  // not pass `camera.pitch` here -- it is not an angle and mixing the two
  // up produces exactly the kind of erratic, wrapping direction a bug in
  // this class used to (feeding a pixel-scale value into Math.cos/sin as
  // if it were radians). `angle` and `pitchRadians` are both real radians;
  // `pitchRadians` defaults to 0 (level aim) if omitted. Static because
  // it's pure trig with no dependency on any Raycaster instance state --
  // callers that don't have a raycaster handy can still use it via
  // `Raycaster.getForwardVector(...)`.
  static getForwardVector(angle, pitchRadians = 0) {
    const cosPitch = Math.cos(pitchRadians);
    return {
      x: Math.cos(angle) * cosPitch,
      y: Math.sin(angle) * cosPitch,
      z: Math.sin(pitchRadians),
    };
  }

  // The real 3D forward direction that matches what's actually rendered at
  // screen centre for a given camera -- i.e. the same camera-shaped object
  // passed to renderSnapshot ({angle, pitch, ...}). Converting `camera.pitch`
  // to an angle by treating it as degrees or radians directly (a real,
  // shipped bug -- see ItemSystem.fireFromCamera's history) produces a
  // vertical angle steeper or shallower than what the player is actually
  // looking at, because `camera.pitch` is a screen-space horizon shift in
  // pixels, not an angle at all (see raycaster-api.md). The correct
  // equivalent angle is derived the same way projectWorldZ() relates world
  // Z to screen Y: solving `screenY = renderHorizon - worldZOffset *
  // focalLength / distance` for the world Z offset at screen centre
  // (screenY = height/2, i.e. renderHorizon - screenY = camera.pitch) gives
  // `worldZOffset / distance = camera.pitch / focalLength`, i.e.
  // `tan(pitchAngle) = camera.pitch / focalLength` -- so this is the one
  // place that conversion should happen, using this instance's own
  // `focalLength` (the same value projectWorldZ() itself uses), instead of
  // callers each guessing at degrees/radians.
  getCameraForwardVector(camera) {
    const pitchRadians = Math.atan2(camera.pitch ?? 0, this.focalLength);
    return Raycaster.getForwardVector(camera.angle, pitchRadians);
  }

  projectHeight(worldHeight, distance) {
    return distance > 0 ? (worldHeight * this.focalLength) / distance : 0;
  }

  // The sole world-Z to screen-Y conversion used by walls and planes.
  projectWorldZ(worldZ, correctedDistance) {
    if (correctedDistance <= 0) return this.height / 2;
    return (
      (this.renderHorizon ?? this.height / 2) -
      this.projectHeight(
        worldZ - (this.renderCameraHeight ?? this.cameraHeight),
        correctedDistance,
      )
    );
  }

  // The sole camera-space-lateral to screen-X conversion. Walls/planes reach
  // the same screenX implicitly via createColumnGeometry()'s per-column ray
  // angles instead of calling this directly; see the class-level comment.
  projectLateralToScreenX(lateral, depth) {
    return this.width / 2 + (lateral * this.focalLength) / depth;
  }

  getCorrectedDistance(distance, rayAngle, playerAngle) {
    return Math.max(0.0001, distance * Math.cos(rayAngle - playerAngle));
  }

  updateProjection(camera) {
    const renderer = this.renderer ?? this;
    SoftwareRenderer.prototype.updateProjection.call(renderer, camera);
    if (this.renderer) {
      this.fov = renderer.fov;
      this.focalLength = renderer.focalLength;
      this.columnGeometry = renderer.columnGeometry;
      this.renderCameraHeight = renderer.renderCameraHeight;
      this.renderHorizon = renderer.renderHorizon;
      this.planeRowFactors = renderer.planeRowFactors;
    }
  }

  getPlaneDistanceAtScreenY(...args) {
    return this.callRenderer("getPlaneDistanceAtScreenY", args);
  }

  getPlaneScreenY(...args) {
    return this.callRenderer("getPlaneScreenY", args);
  }

  getBillboardWorldSize(sprite) {
    const scale = sprite.scale ?? 1;
    const scaleX = typeof scale === "number" ? scale : (scale.x ?? 1);
    const scaleY = typeof scale === "number" ? scale : (scale.y ?? scaleX);
    const width = sprite.width ?? sprite.billboardWidth ?? 1;
    const height = sprite.height ?? sprite.billboardHeight ?? width;
    return { width: width * scaleX, height: height * scaleY };
  }

  wrap(value, size) {
    if (!size || size <= 0) return 0;
    return ((value % size) + size) % size;
  }

  callRenderer(method, args) {
    const renderer = this.renderer?.fallback ?? this.renderer ?? this;
    return SoftwareRenderer.prototype[method].apply(renderer, args);
  }

  createRay(...args) {
    return this.callRenderer("createRay", args);
  }

  stepRay(...args) {
    return this.callRenderer("stepRay", args);
  }

  traceRay(...args) {
    return this.callRenderer("traceRay", args);
  }

  castRay(originX, originY, angle) {
    for (const segment of this.traceRay(originX, originY, angle)) {
      if ((segment.cell.sections ?? []).length && segment.entrySide !== null) {
        return {
          distance: segment.entryDistance,
          side: segment.entrySide,
          mapX: segment.mapX,
          mapY: segment.mapY,
          hitX: segment.entryHitX,
          hitY: segment.entryHitY,
          cell: segment.cell,
        };
      }
    }
    return null;
  }

  // Cheap gameplay/AI line-of-sight query, entirely independent of
  // rendering: reuses the same 2D grid DDA (createRay/stepRay) traceRay()
  // is built on, but does no projection, texture sampling, or pixel work.
  // `origin`/`target` are plain {x, y, z?} world-space points (z defaults
  // to 0, matching sprites/lights); this never renders a frame.
  //
  // A cell boundary blocks sight only where one of its `sections` actually
  // covers the height the straight 3D line has at that point -- an open
  // section (a window, a gap) is transparent to this exactly as it is to
  // rendering, and reads the level's live cell data, so a caller that
  // mutates a cell's `sections` between calls (e.g. a door opening) sees
  // the change immediately with no separate step required.
  checkVisibility(origin, target) {
    const originZ = origin.z ?? 0;
    const targetZ = target.z ?? 0;
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dz = targetZ - originZ;
    const horizontalDistance = Math.sqrt(dx * dx + dy * dy);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const clear = () => ({
      visible: true,
      distance,
      hitDistance: null,
      hitX: null,
      hitY: null,
      mapX: null,
      mapY: null,
      cell: null,
    });

    // Purely vertical line of sight (same XY position): no grid boundary
    // can ever cross it.
    if (horizontalDistance < 1e-9) return clear();

    const angle = Math.atan2(dy, dx);
    const ray = this.createRay(origin.x, origin.y, angle);
    const maxSteps = this.level.width * this.level.height * 2 + 4;

    for (let step = 0; step < maxSteps; step++) {
      const boundary = this.stepRay(ray);
      if (boundary.distance >= horizontalDistance) return clear();

      const cell = this.getCell(boundary.mapX, boundary.mapY);
      const sections = cell?.sections ?? [];
      if (sections.length) {
        const fraction = boundary.distance / horizontalDistance;
        const height = originZ + dz * fraction;
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          if (height >= section.bottom && height <= section.top) {
            return {
              visible: false,
              distance,
              hitDistance: distance * fraction,
              hitX: boundary.hitX,
              hitY: boundary.hitY,
              mapX: boundary.mapX,
              mapY: boundary.mapY,
              cell,
            };
          }
        }
      }
      // Stepped outside the defined map without reaching the target or
      // being blocked -- treat conservatively as not visible rather than
      // guessing (this implies the target isn't actually within the
      // level, which shouldn't happen in normal use).
      if (!this.isInsideMap(boundary.mapX, boundary.mapY)) {
        return { ...clear(), visible: false };
      }
    }
    return { ...clear(), visible: false };
  }

  render(player) {
    return this.renderSnapshot(this.createCameraSnapshot(player));
  }

  renderSnapshot(camera) {
    const uploadStart = this.debug ? performance.now() : 0;
    const result = this.renderer.renderSnapshot(camera);
    this.texture.context.putImageData(this.imageData, 0, 0);
    this.texture.dirty = true;
    if (this.debug) {
      this.renderer.debugStats.uploadMs = performance.now() - uploadStart;
      this.renderer.debugStats.frameMs += this.renderer.debugStats.uploadMs;
      this.renderer.reportDebugStats();
    }
    const activeRenderer = this.renderer.fallback ?? this.renderer;
    this.lastLighting = activeRenderer.lastLighting;
    this.debugStats = activeRenderer.debugStats;
    this.debugFrame = activeRenderer.debugFrame;
    this.fov = activeRenderer.fov;
    this.focalLength = activeRenderer.focalLength;
    this.columnGeometry = activeRenderer.columnGeometry;
    this.renderCameraHeight = activeRenderer.renderCameraHeight;
    this.renderHorizon = activeRenderer.renderHorizon;
    this.planeRowFactors = activeRenderer.planeRowFactors;
    return result;
  }

  // Lighting input contract (P8-02): the caller (eventually a LightSystem)
  // owns which lights exist and decides which are active each frame; the
  // Raycaster only turns that plain per-frame list into pixel brightness.
  // No lifecycle, identity, or persistence for lights lives in the
  // renderer, matching the existing `camera.sprites` contract exactly.
  // `camera.lights: []` and/or `camera.ambient: 1` (the defaults) must
  // reproduce unlit output exactly -- lighting is strictly additive, never
  // required, so outdoor/unlit scenes need no special caller-side logic.
  resolveLights(lights) {
    return this.callRenderer("resolveLights", [lights]);
  }

  // Simple distance-based attenuation, no shadows/occlusion: every resolved
  // light contributes regardless of intervening geometry. `ambient` is the
  // baseline multiplier every surface gets before lights are added, so
  // `ambient: 1` with no lights is a no-op (r=g=b=1, i.e. unchanged colour).
  sampleLightRgb(worldX, worldY, worldZ, ambient, lights) {
    return this.callRenderer("sampleLightRgb", [
      worldX,
      worldY,
      worldZ,
      ambient,
      lights,
    ]);
  }

  // Fog "zones" are just whichever cells carry a `fog` config (see
  // normaliseCellDefinition()) -- there is no separate zone/region system.
  // Linear falloff by distance, applied per surface using whatever depth
  // that surface already computed for other purposes (see call sites in
  // drawWallSection/drawPlanePixel/renderBillboard); no cross-zone blending. A
  // cell with no `fog` costs nothing here (returns null immediately), so
  // the common unfogged case is unaffected.
  getFogBlend(fog, distance) {
    return this.callRenderer("getFogBlend", [fog, distance]);
  }

  fillFlatSky(...args) {
    return this.callRenderer("fillFlatSky", args);
  }

  renderSky(...args) {
    return this.callRenderer("renderSky", args);
  }

  getSpriteCameraSpace(...args) {
    return this.callRenderer("getSpriteCameraSpace", args);
  }

  getSpriteProjectionDiagnostic(...args) {
    return this.callRenderer("getSpriteProjectionDiagnostic", args);
  }

  projectBillboard(...args) {
    return this.callRenderer("projectBillboard", args);
  }

  subtractInterval(...args) {
    return this.callRenderer("subtractInterval", args);
  }

  resizeToCamera() {
    this.sprite.scale.set(
      this.game.width / this.width,
      this.game.height / this.height,
    );
  }

  destroy() {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
    this.texture = null;
    this.canvas = null;
    this.ctx = null;
    this.imageData = null;
    this.cells = {};
    this.materialCache = Object.create(null);
    this.sky = null;
    this.renderer?.destroy?.();
    this.renderer = null;
  }
}
