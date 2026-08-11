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
export class Raycaster {
  // Distance fog's built-in fallback colour matches the sky fill colour
  // (fillSky() below) -- unconfigured fog blending toward the horizon
  // colour is the conventional, natural-looking default.
  static DEFAULT_FOG_COLOR = { r: 70, g: 110, b: 160 };

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
    this.backgroundPixels = new Uint8ClampedArray(this.imageData.data.length);
    this.fillSky(this.backgroundPixels);

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
  }

  normaliseMap(map) {
    return (map || []).map((row) =>
      typeof row === "string" ? row.split("") : Array.from(row || [], String),
    );
  }

  normaliseCellDefinition(definition = {}) {
    const wall = definition.wall ?? null;
    return {
      floorHeight: definition.floorHeight ?? this.level.defaultFloorHeight ?? 0,
      ceilingHeight:
        definition.ceilingHeight ??
        this.level.defaultCeilingHeight ??
        this.wallHeight,
      wall,
      floor: definition.floor ?? null,
      ceiling: definition.ceiling ?? null,
      // `wall` controls rendering a vertical face; `blocking` controls
      // movement collision. They default together (a wall blocks) so
      // existing levels are unaffected, but a level can set `blocking:
      // false` on a low wall/curb cell to make it a walkable step while
      // still rendering its riser face.
      blocking: definition.blocking ?? !!wall,
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
    return { ...this.debugStats };
  }

  getMaterialStats() {
    return {
      entries: Object.keys(this.materialCache).length,
      hits: this.materialCacheHits,
      misses: this.materialCacheMisses,
    };
  }

  resetColumnDepth() {
    this.columnDepth.fill(Infinity);
    this.pixelDepth.fill(Infinity);
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
        wall: this.loadSurface(definition.wall),
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

  // Movement-blocking check. Driven by the cell's configurable `blocking`
  // flag, not by whether it renders a wall face (`cell.wall`) — a cell can
  // have a wall texture and still be non-blocking (a step/curb).
  isWall(x, y) {
    return !!this.getCell(x, y)?.blocking;
  }

  isWallWorld(x, y) {
    return this.isWall(x / this.cellSize, y / this.cellSize);
  }

  // The height a standing entity would rest on in this cell, for callers
  // that want to raise/lower camera/entity Z when moving across cells (e.g.
  // camera.z = raycaster.getEyeHeightWorld(player.x, player.y)).
  //
  // A non-blocking cell that still has a wall face is a walkable step or
  // block (see normaliseCellDefinition()): its standing surface is the top
  // of that block, `ceilingHeight`, not its base. An open cell (no wall, or
  // a blocking one an entity could never be standing in) rests on its
  // `floorHeight`.
  getStandingHeight(x, y) {
    const cell = this.getCell(x, y);
    if (!cell) return 0;
    if (cell.wall && !cell.blocking) return cell.ceilingHeight;
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

  createRay(originX, originY, angle, cachedDirX, cachedDirY) {
    const dirX = cachedDirX ?? Math.cos(angle);
    const dirY = cachedDirY ?? Math.sin(angle);
    const mapX = Math.floor(originX / this.cellSize);
    const mapY = Math.floor(originY / this.cellSize);
    return {
      originX,
      originY,
      dirX,
      dirY,
      mapX,
      mapY,
      stepX: dirX < 0 ? -1 : 1,
      stepY: dirY < 0 ? -1 : 1,
      deltaDistX: dirX === 0 ? Infinity : Math.abs(this.cellSize / dirX),
      deltaDistY: dirY === 0 ? Infinity : Math.abs(this.cellSize / dirY),
      sideDistX:
        dirX < 0
          ? (originX - mapX * this.cellSize) / Math.abs(dirX)
          : ((mapX + 1) * this.cellSize - originX) / Math.abs(dirX),
      sideDistY:
        dirY < 0
          ? (originY - mapY * this.cellSize) / Math.abs(dirY)
          : ((mapY + 1) * this.cellSize - originY) / Math.abs(dirY),
    };
  }

  stepRay(ray) {
    let side;
    if (ray.sideDistX < ray.sideDistY) {
      ray.distance = ray.sideDistX;
      ray.sideDistX += ray.deltaDistX;
      ray.mapX += ray.stepX;
      side = 0;
    } else {
      ray.distance = ray.sideDistY;
      ray.sideDistY += ray.deltaDistY;
      ray.mapY += ray.stepY;
      side = 1;
    }
    return {
      distance: ray.distance,
      side,
      mapX: ray.mapX,
      mapY: ray.mapY,
      hitX: ray.originX + ray.dirX * ray.distance,
      hitY: ray.originY + ray.dirY * ray.distance,
    };
  }

  // One traversal produces all cell segments consumed by the column renderer.
  traceRay(originX, originY, angle, dirX, dirY, output = []) {
    const ray = this.createRay(originX, originY, angle, dirX, dirY);
    const segments = output;
    const maxSteps = this.level.width * this.level.height * 2 + 4;
    let segmentCount = 0;
    let entryDistance = 0;
    let entrySide = null;
    let entryHitX = originX;
    let entryHitY = originY;

    for (let step = 0; step < maxSteps; step++) {
      if (this.debug) this.debugStats.ddaSteps++;
      if (!this.isInsideMap(ray.mapX, ray.mapY)) break;
      const cell = this.getCell(ray.mapX, ray.mapY);
      const currentMapX = ray.mapX;
      const currentMapY = ray.mapY;
      const boundary = this.stepRay(ray);
      const exitDistance = Math.min(boundary.distance, this.maxDistance);

      if (exitDistance > entryDistance) {
        const segment = segments[segmentCount] || {};
        segment.cell = cell;
        segment.mapX = currentMapX;
        segment.mapY = currentMapY;
        segment.entryDistance = entryDistance;
        segment.exitDistance = exitDistance;
        segment.entrySide = entrySide;
        segment.entryHitX = entryHitX;
        segment.entryHitY = entryHitY;
        segment.dirX = ray.dirX;
        segment.dirY = ray.dirY;
        segments[segmentCount++] = segment;
        if (this.debug) this.debugStats.segments++;
      }
      if (boundary.distance >= this.maxDistance) break;
      if (!this.isInsideMap(boundary.mapX, boundary.mapY)) break;
      entryDistance = boundary.distance;
      entrySide = boundary.side;
      entryHitX = boundary.hitX;
      entryHitY = boundary.hitY;
    }
    segments.length = segmentCount;
    return segments;
  }

  castRay(originX, originY, angle) {
    for (const segment of this.traceRay(originX, originY, angle)) {
      if (segment.cell.wall && segment.entrySide !== null) {
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

  render(player) {
    return this.renderSnapshot(this.createCameraSnapshot(player));
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
    if (!lights || !lights.length) return [];
    const resolved = [];
    for (const light of lights) {
      if (!light) continue;
      const radius = light.radius ?? 0;
      const intensity = light.intensity ?? 1;
      if (radius <= 0 || intensity <= 0) continue;
      const tint = light.tint ?? {};
      resolved.push({
        x: light.x,
        y: light.y,
        z: light.z ?? 0,
        radius,
        radiusSquared: radius * radius,
        intensity,
        tintR: (tint.r ?? 255) / 255,
        tintG: (tint.g ?? 255) / 255,
        tintB: (tint.b ?? 255) / 255,
      });
    }
    return resolved;
  }

  // Simple distance-based attenuation, no shadows/occlusion: every resolved
  // light contributes regardless of intervening geometry. `ambient` is the
  // baseline multiplier every surface gets before lights are added, so
  // `ambient: 1` with no lights is a no-op (r=g=b=1, i.e. unchanged colour).
  sampleLightRgb(worldX, worldY, worldZ, ambient, lights) {
    let r = ambient;
    let g = ambient;
    let b = ambient;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      const dx = worldX - light.x;
      const dy = worldY - light.y;
      const dz = worldZ - light.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared >= light.radiusSquared) continue;
      const attenuation = 1 - Math.sqrt(distanceSquared) / light.radius;
      const strength = light.intensity * attenuation;
      r += strength * light.tintR;
      g += strength * light.tintG;
      b += strength * light.tintB;
    }
    return { r, g, b };
  }

  // Fog "zones" are just whichever cells carry a `fog` config (see
  // normaliseCellDefinition()) -- there is no separate zone/region system.
  // Linear falloff by distance, applied per surface using whatever depth
  // that surface already computed for other purposes (see call sites in
  // drawWall/drawPlanePixel/renderBillboard); no cross-zone blending. A
  // cell with no `fog` costs nothing here (returns null immediately), so
  // the common unfogged case is unaffected.
  getFogBlend(fog, distance) {
    if (!fog || distance <= 0) return null;
    const amount = Math.min(1, distance / fog.distance);
    return amount > 0 ? { color: fog.color, amount } : null;
  }

  renderSnapshot(camera) {
    this.updateProjection(camera);
    const frameStart = this.debug ? performance.now() : 0;
    if (this.debug) {
      this.resetDebugStats();
      this.debugFrame++;
    }

    const pixels = this.imageData.data;
    pixels.set(this.backgroundPixels);
    this.resetColumnDepth();
    const playerSin = Math.sin(camera.angle);
    const playerCos = Math.cos(camera.angle);
    const traceStart = this.debug ? performance.now() : 0;

    const resolvedLights = this.resolveLights(camera.lights);
    const ambient = camera.ambient ?? 1;
    const lighting = {
      ambient,
      lights: resolvedLights,
      active: ambient !== 1 || resolvedLights.length > 0,
    };

    for (let screenX = 0; screenX < this.width; screenX++) {
      const column = this.columnGeometry[screenX];
      const rayAngle = camera.angle + column.angleOffset;
      const dirX = playerCos * column.cos - playerSin * column.sin;
      const dirY = playerSin * column.cos + playerCos * column.sin;
      this.renderColumn(
        camera,
        rayAngle,
        screenX,
        this.traceRay(
          camera.x,
          camera.y,
          rayAngle,
          dirX,
          dirY,
          this.segmentScratch[screenX],
        ),
        pixels,
        column.rayCos,
        lighting,
      );
    }
    this.renderSprites(camera, camera.sprites, pixels, lighting);
    if (this.debug) this.debugStats.traceMs = performance.now() - traceStart;

    const uploadStart = this.debug ? performance.now() : 0;
    this.texture.context.putImageData(this.imageData, 0, 0);
    this.texture.dirty = true;
    if (this.debug) {
      this.debugStats.uploadMs = performance.now() - uploadStart;
      this.debugStats.frameMs = performance.now() - frameStart;
      this.reportDebugStats();
    }
  }

  renderSprites(camera, sprites, pixels, lighting) {
    if (!sprites || !sprites.length) return;

    const ordered = sprites
      .filter((sprite) => sprite && sprite.texture)
      .map((sprite) => {
        const cameraSpace = this.getSpriteCameraSpace(camera, sprite);
        return { sprite, cameraSpace };
      })
      .filter(({ cameraSpace }) => cameraSpace.depth > 0.0001)
      .sort((a, b) => b.cameraSpace.depth - a.cameraSpace.depth);

    for (const { sprite, cameraSpace } of ordered) {
      this.renderBillboard(camera, sprite, cameraSpace, pixels, lighting);
    }
  }

  getSpriteCameraSpace(camera, sprite) {
    const dx = sprite.x - camera.x;
    const dy = sprite.y - camera.y;
    const sin = Math.sin(camera.angle);
    const cos = Math.cos(camera.angle);

    // `lateral` is the camera-right offset, `depth` is the forward-axis
    // distance (not Euclidean distance). The vertical camera axis is world Z
    // and is projected separately via projectWorldZ.
    return {
      dx,
      dy,
      lateral: -dx * sin + dy * cos,
      depth: dx * cos + dy * sin,
    };
  }

  getSpriteProjectionDiagnostic(camera, sprite) {
    const cameraSpace = this.getSpriteCameraSpace(camera, sprite);
    const projection = this.projectBillboard(camera, sprite, cameraSpace);
    return {
      worldX: sprite.x,
      worldY: sprite.y,
      cameraX: camera.x,
      cameraY: camera.y,
      angle: camera.angle,
      dx: cameraSpace.dx,
      dy: cameraSpace.dy,
      lateral: cameraSpace.lateral,
      depth: cameraSpace.depth,
      projectedScreenX: projection?.centerX ?? null,
    };
  }

  renderBillboard(camera, sprite, cameraSpace, pixels, lighting) {
    const projection = this.projectBillboard(camera, sprite, cameraSpace);
    if (!projection) return;
    const { left, right, top, bottom } = projection;
    const startX = Math.max(0, left);
    const endX = Math.min(this.width - 1, right);
    const startY = Math.max(0, Math.ceil(top));
    const endY = Math.min(this.height - 1, Math.floor(bottom));
    if (startX > endX || startY > endY) return;

    const surface = this.loadSpriteSurface(sprite.texture);
    if (!surface) return;

    // Sprites are flat billboards with no per-pixel world depth of their
    // own, so lighting is sampled once at the sprite's anchor and applied
    // uniformly, rather than per pixel like walls/planes.
    const light =
      lighting && lighting.active
        ? this.sampleLightRgb(
            sprite.x,
            sprite.y,
            sprite.z ?? 0,
            lighting.ambient,
            lighting.lights,
          )
        : null;
    // A sprite is fogged by whichever cell it's standing in -- there's no
    // separate zone lookup, it reuses the same per-cell `fog` config walls
    // and planes do.
    const spriteCell = this.getCell(
      sprite.x / this.cellSize,
      sprite.y / this.cellSize,
    );
    const fog = this.getFogBlend(spriteCell?.fog, cameraSpace.depth);

    for (let screenX = startX; screenX <= endX; screenX++) {
      const textureX = Math.max(
        0,
        Math.min(
          surface.widthPixels - 1,
          Math.floor(
            ((screenX - left) / Math.max(1, right - left + 1)) *
              surface.widthPixels,
          ),
        ),
      );
      for (let screenY = startY; screenY <= endY; screenY++) {
        const depthIndex = screenY * this.width + screenX;
        if (this.pixelDepth[depthIndex] <= cameraSpace.depth) continue;
        const textureY = Math.max(
          0,
          Math.min(
            surface.heightPixels - 1,
            Math.floor(
              ((screenY - top) / Math.max(1, bottom - top + 1)) *
                surface.heightPixels,
            ),
          ),
        );
        this.copySpritePixel(
          pixels,
          screenX,
          screenY,
          surface,
          textureX,
          textureY,
          light,
          fog,
        );
      }
    }

    if (this.debugSpriteAnchors) {
      this.drawSpriteAnchor(projection.centerX, projection.bottom, pixels);
    }
  }

  projectBillboard(camera, sprite, cameraSpace) {
    if (cameraSpace.depth <= 0.0001) return null;
    const centerX = this.projectLateralToScreenX(
      cameraSpace.lateral,
      cameraSpace.depth,
    );
    const size = this.getBillboardWorldSize(sprite);
    const worldWidth = size.width;
    const worldHeight = size.height;
    const projectedWidth = (worldWidth * this.focalLength) / cameraSpace.depth;
    const projectedHeight =
      (worldHeight * this.focalLength) / cameraSpace.depth;
    if (projectedWidth <= 0 || projectedHeight <= 0) return null;

    const left = Math.ceil(centerX - projectedWidth / 2);
    const right = Math.floor(centerX + projectedWidth / 2);
    const bottom = this.projectWorldZ(sprite.z ?? 0, cameraSpace.depth);
    const top = bottom - projectedHeight;

    return {
      centerX,
      projectedWidth,
      projectedHeight,
      left,
      right,
      top,
      bottom,
    };
  }

  drawSpriteAnchor(screenX, screenY, pixels) {
    const x = Math.round(screenX);
    const y = Math.round(screenY);
    for (let offset = -2; offset <= 2; offset++) {
      this.setDebugPixel(pixels, x + offset, y, 255, 0, 255);
      this.setDebugPixel(pixels, x, y + offset, 255, 0, 255);
    }
  }

  setDebugPixel(pixels, x, y, red, green, blue) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (y * this.width + x) * 4;
    pixels[index] = red;
    pixels[index + 1] = green;
    pixels[index + 2] = blue;
    pixels[index + 3] = 255;
  }

  getBillboardWorldSize(sprite) {
    const scale = sprite.scale ?? 1;
    const scaleX = typeof scale === "number" ? scale : (scale.x ?? 1);
    const scaleY = typeof scale === "number" ? scale : (scale.y ?? scaleX);
    const width = sprite.width ?? sprite.billboardWidth ?? 1;
    const height = sprite.height ?? sprite.billboardHeight ?? width;

    return {
      width: width * scaleX,
      height: height * scaleY,
    };
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

  updateProjection(camera) {
    const fov = camera.fov ?? this.fov;
    const pitch = camera.pitch ?? 0;

    if (fov !== this.fov) {
      this.fov = fov;
      this.focalLength = this.computeFocalLength(this.fov);
      this.columnGeometry = this.createColumnGeometry(this.fov);
    }

    this.renderCameraHeight = camera.z ?? this.cameraHeight;
    this.renderHorizon = this.height / 2 + pitch;
    this.planeRowFactors = this.createPlaneRowFactors(
      this.focalLength,
      this.renderHorizon,
    );
  }

  fillSky(pixels) {
    const horizon = Math.floor(this.height / 2);
    const sky = Raycaster.DEFAULT_FOG_COLOR;
    for (let y = 0; y < horizon; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = (y * this.width + x) * 4;
        pixels[index] = sky.r;
        pixels[index + 1] = sky.g;
        pixels[index + 2] = sky.b;
        pixels[index + 3] = 255;
      }
    }
  }

  renderColumn(
    camera,
    rayAngle,
    screenX,
    segments,
    pixels,
    cachedRayCos,
    lighting,
  ) {
    const visible = this.visibleIntervalScratch[screenX];
    visible[0] = 0;
    visible[1] = this.height - 1;
    let visibleCount = 1;
    if (this.debug) this.debugStats.visibleIntervals++;
    const rayCos = cachedRayCos ?? Math.cos(rayAngle - camera.angle);
    for (const segment of segments) {
      if (!visibleCount) break;

      if (segment.cell.wall && segment.entrySide !== null) {
        if (this.debug) this.debugStats.wallSegments++;
        const distance = this.getCorrectedDistance(
          segment.entryDistance,
          rayAngle,
          camera.angle,
        );
        segment.projectedDistance = distance;
        const top = this.projectWorldZ(segment.cell.ceilingHeight, distance);
        const bottom = this.projectWorldZ(segment.cell.floorHeight, distance);
        this.drawWall(
          screenX,
          segment,
          top,
          bottom,
          pixels,
          visible,
          visibleCount,
          lighting,
        );
        visibleCount = this.subtractInterval(
          visible,
          top,
          bottom,
          visibleCount,
        );
        if (!visibleCount && this.columnDepth[screenX] === Infinity) {
          this.columnDepth[screenX] = distance;
        }
      }

      visibleCount = this.renderPlane(
        camera,
        screenX,
        segment,
        segment.cell.floor,
        segment.cell.floorHeight,
        rayCos,
        pixels,
        visible,
        visibleCount,
        lighting,
      );
      visibleCount = this.renderPlane(
        camera,
        screenX,
        segment,
        segment.cell.ceiling,
        segment.cell.ceilingHeight,
        rayCos,
        pixels,
        visible,
        visibleCount,
        lighting,
      );
    }
  }

  renderPlane(
    camera,
    screenX,
    segment,
    surface,
    planeHeight,
    rayCos,
    pixels,
    visible,
    visibleCount,
    lighting,
  ) {
    if (
      !surface ||
      planeHeight === (this.renderCameraHeight ?? this.cameraHeight)
    )
      return visibleCount;
    const entryScreenY = this.getPlaneScreenY(
      planeHeight,
      segment.entryDistance,
      rayCos,
    );
    const exitScreenY = this.getPlaneScreenY(
      planeHeight,
      segment.exitDistance,
      rayCos,
    );
    if (entryScreenY === null || exitScreenY === null) return visibleCount;

    const planeTop = Math.min(entryScreenY, exitScreenY);
    const planeBottom = Math.max(entryScreenY, exitScreenY);
    const start = Math.max(0, Math.ceil(planeTop));
    const end = Math.min(this.height - 1, Math.floor(planeBottom));
    for (let y = start; y <= end; y++) {
      if (this.debug) this.debugStats.planePixelsTested++;
      if (!this.isYVisible(visible, visibleCount, y)) continue;
      const distance = this.getPlaneDistanceAtScreenY(planeHeight, y, rayCos);
      if (
        distance === null ||
        distance < segment.entryDistance - 0.0001 ||
        distance > segment.exitDistance + 0.0001
      )
        continue;
      this.drawPlanePixel(
        screenX,
        y,
        camera.x + segment.dirX * distance,
        camera.y + segment.dirY * distance,
        planeHeight,
        distance,
        surface,
        pixels,
        lighting,
        segment.cell.fog,
      );
      if (this.debug) this.debugStats.planePixelsDrawn++;
    }
    return this.subtractInterval(visible, planeTop, planeBottom, visibleCount);
  }

  getPlaneDistanceAtScreenY(planeHeight, screenY, rayCos) {
    const factor = this.planeRowFactors[screenY];
    if (!Number.isFinite(factor)) return null;
    return (
      (Math.abs(planeHeight - (this.renderCameraHeight ?? this.cameraHeight)) *
        Math.abs(factor)) /
      Math.max(0.0001, Math.abs(rayCos))
    );
  }

  getPlaneScreenY(planeHeight, rayDistance, rayCos) {
    if (rayDistance <= 0) {
      return planeHeight > (this.renderCameraHeight ?? this.cameraHeight)
        ? -Infinity
        : Infinity;
    }

    return this.projectWorldZ(planeHeight, rayDistance * rayCos);
  }

  drawWall(
    screenX,
    segment,
    top,
    bottom,
    pixels,
    visible,
    visibleCount,
    lighting,
  ) {
    const wall = segment.cell.wall;
    const start = Math.max(0, Math.ceil(top));
    const end = Math.min(this.height - 1, Math.floor(bottom));
    if (start > end || !Number.isFinite(top) || !Number.isFinite(bottom))
      return;
    const wallHeight = segment.cell.ceilingHeight - segment.cell.floorHeight;
    const projectedHeight = bottom - top;
    if (wallHeight <= 0 || projectedHeight <= 0) return;

    const wallPositionWorld =
      segment.entrySide === 0 ? segment.entryHitY : segment.entryHitX;
    const textureX = Math.max(
      0,
      Math.min(
        wall.widthPixels - 1,
        Math.floor(
          (this.wrap(wallPositionWorld, wall.width) / wall.width) *
            wall.widthPixels,
        ),
      ),
    );
    // The whole wall segment sits at one perpendicular depth regardless of
    // row (only its texture row varies), so fog is resolved once per
    // column rather than once per pixel.
    const fog = this.getFogBlend(
      segment.cell.fog,
      segment.projectedDistance ?? segment.entryDistance,
    );
    for (let y = start; y <= end; y++) {
      if (this.debug) this.debugStats.wallPixels++;
      if (!this.isYVisible(visible, visibleCount, y)) continue;
      const position = (y - top) / projectedHeight;
      const worldZ = segment.cell.ceilingHeight - position * wallHeight;
      const textureY = Math.max(
        0,
        Math.min(
          wall.heightPixels - 1,
          Math.floor(
            (this.wrap(worldZ - segment.cell.floorHeight, wall.height) /
              wall.height) *
              wall.heightPixels,
          ),
        ),
      );
      const light =
        lighting && lighting.active
          ? this.sampleLightRgb(
              segment.entryHitX,
              segment.entryHitY,
              worldZ,
              lighting.ambient,
              lighting.lights,
            )
          : null;
      this.copyPixel(pixels, screenX, y, wall, textureX, textureY, light, fog);
      this.pixelDepth[y * this.width + screenX] = Math.min(
        this.pixelDepth[y * this.width + screenX],
        segment.projectedDistance ?? segment.entryDistance,
      );
    }
  }

  isYVisible(intervals, count, y) {
    if (this.debug) this.debugStats.visibleIntervalChecks += count;
    for (let index = 0; index < count; index++) {
      const offset = index * 2;
      if (y >= intervals[offset] && y <= intervals[offset + 1]) return true;
    }
    return false;
  }

  subtractInterval(intervals, top, bottom, count) {
    if (
      bottom < 0 ||
      top >= this.height ||
      (!Number.isFinite(bottom) && bottom !== Infinity)
    )
      return count;
    const cutTop = Math.max(0, Math.ceil(top));
    const cutBottom = Math.min(this.height - 1, Math.floor(bottom));
    if (cutTop > cutBottom) return count;

    for (let index = 0; index < count; index++) {
      const offset = index * 2;
      const intervalTop = intervals[offset];
      const intervalBottom = intervals[offset + 1];

      if (cutBottom < intervalTop || cutTop > intervalBottom) {
        continue;
      }

      const hasUpper = cutTop > intervalTop;
      const hasLower = cutBottom < intervalBottom;

      if (hasUpper && hasLower) {
        if (count >= this.visibleIntervalCapacity) {
          intervals[offset + 1] = cutTop - 1;
          return count;
        }

        for (let move = count; move > index + 1; move--) {
          intervals[move * 2] = intervals[(move - 1) * 2];
          intervals[move * 2 + 1] = intervals[(move - 1) * 2 + 1];
        }
        intervals[offset + 1] = cutTop - 1;
        intervals[(index + 1) * 2] = cutBottom + 1;
        intervals[(index + 1) * 2 + 1] = intervalBottom;
        count++;
        index++;
        continue;
      }

      if (hasUpper) {
        intervals[offset + 1] = cutTop - 1;
        continue;
      }

      if (hasLower) {
        intervals[offset] = cutBottom + 1;
        continue;
      }

      for (let move = index; move < count - 1; move++) {
        intervals[move * 2] = intervals[(move + 1) * 2];
        intervals[move * 2 + 1] = intervals[(move + 1) * 2 + 1];
      }
      count--;
      index--;
    }
    return count;
  }

  drawPlanePixel(
    screenX,
    screenY,
    worldX,
    worldY,
    worldZ,
    distance,
    surface,
    pixels,
    lighting,
    fogConfig,
  ) {
    const textureX = Math.max(
      0,
      Math.min(
        surface.widthPixels - 1,
        Math.floor(
          (this.wrap(worldX, surface.width) / surface.width) *
            surface.widthPixels,
        ),
      ),
    );
    const textureY = Math.max(
      0,
      Math.min(
        surface.heightPixels - 1,
        Math.floor(
          (this.wrap(worldY, surface.height) / surface.height) *
            surface.heightPixels,
        ),
      ),
    );
    const light =
      lighting && lighting.active
        ? this.sampleLightRgb(
            worldX,
            worldY,
            worldZ,
            lighting.ambient,
            lighting.lights,
          )
        : null;
    // Unlike walls, a plane's distance genuinely varies per row (the floor
    // gets closer toward the bottom of the screen), so fog is resolved per
    // pixel here rather than once per segment.
    const fog = this.getFogBlend(fogConfig, distance);
    this.copyPixel(
      pixels,
      screenX,
      screenY,
      surface,
      textureX,
      textureY,
      light,
      fog,
    );
  }

  // `light`, when supplied, is an {r,g,b} multiplier from sampleLightRgb();
  // `fog`, when supplied, is a {color,amount} blend from getFogBlend(),
  // applied after lighting (fog is atmosphere between the surface and the
  // camera, not a property of the surface itself). Both are optional and
  // independent. With neither, the original fast path (unchanged since
  // before lighting/fog existed) runs -- the common case for any level
  // that doesn't opt into either feature pays no extra per-pixel cost
  // beyond the one guard check below.
  copyPixel(pixels, screenX, screenY, surface, textureX, textureY, light, fog) {
    const source = (textureY * surface.widthPixels + textureX) * 4;
    const destination = (screenY * this.width + screenX) * 4;
    if (!light && !fog) {
      pixels[destination] = surface.pixels[source];
      pixels[destination + 1] = surface.pixels[source + 1];
      pixels[destination + 2] = surface.pixels[source + 2];
      pixels[destination + 3] = 255;
      return;
    }
    let r = surface.pixels[source];
    let g = surface.pixels[source + 1];
    let b = surface.pixels[source + 2];
    if (light) {
      r *= light.r;
      g *= light.g;
      b *= light.b;
    }
    if (fog) {
      r += (fog.color.r - r) * fog.amount;
      g += (fog.color.g - g) * fog.amount;
      b += (fog.color.b - b) * fog.amount;
    }
    pixels[destination] = r;
    pixels[destination + 1] = g;
    pixels[destination + 2] = b;
    pixels[destination + 3] = 255;
  }

  copySpritePixel(
    pixels,
    screenX,
    screenY,
    surface,
    textureX,
    textureY,
    light,
    fog,
  ) {
    const source = (textureY * surface.widthPixels + textureX) * 4;
    if (surface.pixels[source + 3] === 0) return;
    const destination = (screenY * this.width + screenX) * 4;
    if (!light && !fog) {
      pixels[destination] = surface.pixels[source];
      pixels[destination + 1] = surface.pixels[source + 1];
      pixels[destination + 2] = surface.pixels[source + 2];
      pixels[destination + 3] = surface.pixels[source + 3];
      return;
    }
    let r = surface.pixels[source];
    let g = surface.pixels[source + 1];
    let b = surface.pixels[source + 2];
    if (light) {
      r *= light.r;
      g *= light.g;
      b *= light.b;
    }
    if (fog) {
      r += (fog.color.r - r) * fog.amount;
      g += (fog.color.g - g) * fog.amount;
      b += (fog.color.b - b) * fog.amount;
    }
    pixels[destination] = r;
    pixels[destination + 1] = g;
    pixels[destination + 2] = b;
    pixels[destination + 3] = surface.pixels[source + 3];
  }

  wrap(value, size) {
    if (!size || size <= 0) return 0;
    return ((value % size) + size) % size;
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
  }
}
