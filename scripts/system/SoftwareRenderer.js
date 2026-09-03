// Complete JavaScript rendering implementation used by Raycaster.
// This class receives explicit renderer state and has no knowledge of Phaser
// or of the Raycaster facade.
export class SoftwareRenderer {
  constructor(state) {
    Object.assign(this, state);
    this.defaultFogColor = state.defaultFogColor ?? { r: 70, g: 110, b: 160 };
    this.defaultDebugColor = state.defaultDebugColor ?? {
      r: 255,
      g: 0,
      b: 255,
    };
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

  reportDebugStats() {
    if (!this.debug || !this.debugLogEvery) return;
    if (this.debugFrame % this.debugLogEvery !== 0) return;
    console.table({ ...this.debugStats });
  }

  resetColumnDepth() {
    this.columnDepth.fill(Infinity);
    this.pixelDepth.fill(Infinity);
  }

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

  projectHeight(worldHeight, distance) {
    return distance > 0 ? (worldHeight * this.focalLength) / distance : 0;
  }

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

  projectLateralToScreenX(lateral, depth) {
    return this.width / 2 + (lateral * this.focalLength) / depth;
  }

  getCorrectedDistance(distance, rayAngle, playerAngle) {
    return Math.max(0.0001, distance * Math.cos(rayAngle - playerAngle));
  }

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

  sampleLightRgb(worldX, worldY, worldZ, ambient, lights) {
    let r = ambient;
    let g = ambient;
    let b = ambient;
    for (let index = 0; index < lights.length; index++) {
      const light = lights[index];
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

  getFogBlend(fog, distance) {
    if (!fog || distance <= 0) return null;
    const amount = Math.min(1, distance / fog.distance);
    return amount > 0 ? { color: fog.color, amount } : null;
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

  renderSnapshot(camera) {
    this.updateProjection(camera);
    const frameStart = this.debug ? performance.now() : 0;
    if (this.debug) {
      this.resetDebugStats();
      this.debugFrame++;
    }

    const pixels = this.imageData.data;
    pixels.fill(0);
    const skyRows = Math.max(
      0,
      Math.min(this.height, Math.ceil(this.renderHorizon)),
    );
    if (this.sky) this.renderSky(pixels, camera, skyRows);
    else this.fillFlatSky(pixels, skyRows);
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
    this.lastLighting = lighting;

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
    this.renderDebugWireframes(camera, camera.debugObjects, pixels);
    if (this.debug) this.debugStats.traceMs = performance.now() - traceStart;
    if (this.debug) {
      this.debugStats.frameMs = performance.now() - frameStart;
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
      if (sprite.billboard === false) {
        this.renderOrientedSprite(camera, sprite, pixels, lighting);
      } else {
        this.renderBillboard(camera, sprite, cameraSpace, pixels, lighting);
      }
    }
  }

  // Draws just the debugSpriteAnchors crosshair markers (see
  // renderBillboard()/renderOrientedSprite()'s own debugSpriteAnchors
  // branches, which this reproduces exactly for the same anchor point --
  // centerX, projectWorldZ(sprite.z, depth) -- rather than reimplementing
  // anything new), without rendering the sprites themselves. Exists so a
  // renderer that draws sprites some other way (WasmRenderer's native
  // path) can still overlay this JS-only debug aid on top of its own
  // framebuffer -- see WasmRenderer.renderSnapshot(). No-ops immediately
  // if debugSpriteAnchors isn't enabled, so calling this unconditionally
  // elsewhere costs nothing in the common case.
  renderSpriteAnchors(camera, sprites, pixels) {
    if (!this.debugSpriteAnchors || !sprites || !sprites.length) return;
    for (const sprite of sprites) {
      if (!sprite || !sprite.texture) continue;
      const cameraSpace = this.getSpriteCameraSpace(camera, sprite);
      if (cameraSpace.depth <= 0.0001) continue;
      const centerX = this.projectLateralToScreenX(
        cameraSpace.lateral,
        cameraSpace.depth,
      );
      const bottom = this.projectWorldZ(sprite.z ?? 0, cameraSpace.depth);
      this.drawSpriteAnchor(centerX, bottom, pixels);
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

  renderOrientedSprite(camera, sprite, pixels, lighting) {
    const surface = this.loadSpriteSurface(sprite.texture);
    if (!surface) return;
    const size = this.getBillboardWorldSize(sprite);
    const worldWidth = size.width;
    const worldHeight = size.height;
    const z = sprite.z ?? 0;
    const angle = sprite.angle ?? 0;
    const halfWidth = worldWidth / 2;

    // `angle` represents the direction the front face points.
    // The horizontal axis of the sprite is perpendicular to that direction.
    const axisX = -Math.sin(angle);
    const axisY = Math.cos(angle);

    const leftWorld = {
      x: sprite.x - axisX * halfWidth,
      y: sprite.y - axisY * halfWidth,
    };
    const rightWorld = {
      x: sprite.x + axisX * halfWidth,
      y: sprite.y + axisY * halfWidth,
    };
    const leftCamera = this.getSpriteCameraSpace(camera, leftWorld);
    const rightCamera = this.getSpriteCameraSpace(camera, rightWorld);

    // If the whole plane is behind the camera, there's nothing to render.
    if (leftCamera.depth <= 0.0001 && rightCamera.depth <= 0.0001) {
      return;
    }
    // A proper near-plane clip would be needed if one endpoint is behind
    // the camera. For now, avoid projecting through the camera.
    if (leftCamera.depth <= 0.0001 || rightCamera.depth <= 0.0001) {
      return;
    }
    const leftScreenX = this.projectLateralToScreenX(
      leftCamera.lateral,
      leftCamera.depth,
    );
    const rightScreenX = this.projectLateralToScreenX(
      rightCamera.lateral,
      rightCamera.depth,
    );
    const screenLeft = Math.min(leftScreenX, rightScreenX);
    const screenRight = Math.max(leftScreenX, rightScreenX);
    const startX = Math.max(0, Math.ceil(screenLeft));
    const endX = Math.min(this.width - 1, Math.floor(screenRight));

    if (startX > endX) return;

    // Lighting can remain consistent with billboards initially.
    // Later you could use the sprite's facing direction for directional
    // lighting if you add that.
    const light =
      lighting && lighting.active
        ? this.sampleLightRgb(
            sprite.x,
            sprite.y,
            z,
            lighting.ambient,
            lighting.lights,
          )
        : null;
    const spriteCell = this.getCell(
      sprite.x / this.cellSize,
      sprite.y / this.cellSize,
    );
    // Keep track of which projected endpoint corresponds to texture U = 0.
    const xDirection = rightScreenX - leftScreenX;
    if (Math.abs(xDirection) < 0.0001) return;
    for (let screenX = startX; screenX <= endX; screenX++) {
      // Screen-space interpolation parameter.
      const screenT = (screenX - leftScreenX) / xDirection;

      // Perspective-correct interpolation.
      //
      // Interpolating 1/depth is important here. A simple linear depth
      // interpolation causes the texture/geometry to distort when viewed
      // at an angle.
      const invDepth =
        (1 - screenT) / leftCamera.depth + screenT / rightCamera.depth;
      if (invDepth <= 0.000001) continue;
      const depth = 1 / invDepth;

      // Perspective-correct texture coordinate.
      const textureT = screenT / rightCamera.depth / invDepth;
      const textureX = Math.max(
        0,
        Math.min(
          surface.widthPixels - 1,
          Math.floor(textureT * surface.widthPixels),
        ),
      );
      const bottom = this.projectWorldZ(z, depth);
      const top = this.projectWorldZ(z + worldHeight, depth);
      const startY = Math.max(0, Math.ceil(Math.min(top, bottom)));
      const endY = Math.min(this.height - 1, Math.floor(Math.max(top, bottom)));
      if (startY > endY) continue;
      // Fog depth varies across the sprite now, unlike a billboard where
      // the whole surface has one depth.
      const fog = this.getFogBlend(spriteCell?.fog, depth);
      for (let screenY = startY; screenY <= endY; screenY++) {
        const depthIndex = screenY * this.width + screenX;
        if (this.pixelDepth[depthIndex] <= depth) continue;
        const textureY = Math.max(
          0,
          Math.min(
            surface.heightPixels - 1,
            Math.floor(
              ((screenY - top) / Math.max(1, bottom - top)) *
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
      const centerCamera = this.getSpriteCameraSpace(camera, sprite);
      if (centerCamera.depth > 0.0001) {
        const centerX = this.projectLateralToScreenX(
          centerCamera.lateral,
          centerCamera.depth,
        );
        const bottom = this.projectWorldZ(z, centerCamera.depth);
        this.drawSpriteAnchor(centerX, bottom, pixels);
      }
    }
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

  // Caller-supplied debug shapes (see CollisionSystem's `debug` flag),
  // drawn straight into the pixel buffer with no texture and no depth-buffer
  // test -- same approach as drawSpriteAnchor() above -- so a debug cylinder
  // is always visible on top of the frame regardless of what's in front of
  // it. `debugObjects` is a plain array of {x, y, z, radius, height, color?,
  // segments?} entries; nothing about wall/floor/sprite rendering changes.
  renderDebugWireframes(camera, debugObjects, pixels) {
    if (!debugObjects || !debugObjects.length) return;

    for (const wireframe of debugObjects) {
      this.renderDebugCylinder(camera, wireframe, pixels);
    }
  }

  // Approximates a cylinder as a ring of vertical edges plus a top and
  // bottom ring -- enough to read the actual collision diameter, height
  // and position at a glance without rasterising a true curved surface.
  renderDebugCylinder(camera, wireframe, pixels) {
    const {
      x,
      y,
      z = 0,
      radius = 8,
      height = 8,
      segments = 8,
      color = this.defaultDebugColor ?? { r: 255, g: 0, b: 255 },
    } = wireframe;

    const bottom = z;
    const top = z + height;
    const ring = [];

    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      ring.push({
        x: x + Math.cos(theta) * radius,
        y: y + Math.sin(theta) * radius,
      });
    }

    for (let i = 0; i < segments; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % segments];

      this.drawDebugLine3D(
        camera,
        a.x,
        a.y,
        bottom,
        b.x,
        b.y,
        bottom,
        pixels,
        color,
      );
      this.drawDebugLine3D(camera, a.x, a.y, top, b.x, b.y, top, pixels, color);
      this.drawDebugLine3D(
        camera,
        a.x,
        a.y,
        bottom,
        a.x,
        a.y,
        top,
        pixels,
        color,
      );
    }
  }

  drawDebugLine3D(camera, x1, y1, z1, x2, y2, z2, pixels, color) {
    const p1 = this.projectDebugPoint(camera, x1, y1, z1);
    const p2 = this.projectDebugPoint(camera, x2, y2, z2);
    if (!p1 || !p2) return;
    this.drawDebugLine2D(
      p1.screenX,
      p1.screenY,
      p2.screenX,
      p2.screenY,
      pixels,
      color,
    );
  }

  // World point -> screen point using the exact same camera-space transform
  // billboards use (getSpriteCameraSpace / projectLateralToScreenX /
  // projectWorldZ), so a debug wireframe lines up with sprites drawn at the
  // same world position. Drops (rather than clips) segments crossing the
  // camera plane, which is fine for a debug aid.
  projectDebugPoint(camera, x, y, z) {
    const cameraSpace = this.getSpriteCameraSpace(camera, { x, y });
    if (cameraSpace.depth <= 0.0001) return null;
    return {
      screenX: this.projectLateralToScreenX(
        cameraSpace.lateral,
        cameraSpace.depth,
      ),
      screenY: this.projectWorldZ(z, cameraSpace.depth),
    };
  }

  // Bresenham line rasteriser writing straight through setDebugPixel().
  drawDebugLine2D(x1, y1, x2, y2, pixels, color) {
    let x = Math.round(x1);
    let y = Math.round(y1);
    const endX = Math.round(x2);
    const endY = Math.round(y2);

    const dx = Math.abs(endX - x);
    const dy = Math.abs(endY - y);
    const stepX = endX >= x ? 1 : -1;
    const stepY = endY >= y ? 1 : -1;
    let error = dx - dy;

    // Bounded by the segment's own screen-space extent -- a debug edge
    // seen end-on near the camera can still span an enormous pixel
    // distance, so this can't spin longer than the line actually is.
    const maxSteps = dx + dy + 1;
    for (let step = 0; step <= maxSteps; step++) {
      this.setDebugPixel(pixels, x, y, color.r, color.g, color.b);
      if (x === endX && y === endY) break;
      const error2 = error * 2;
      if (error2 > -dy) {
        error -= dy;
        x += stepX;
      }
      if (error2 < dx) {
        error += dx;
        y += stepY;
      }
    }
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

  // Flat-colour sky (no level.sky configured): fills rows [0, skyRows).
  // `skyRows` is renderHorizon for the current frame, clamped to the
  // screen -- not a fixed half of the screen -- so it always reaches
  // exactly as far as the current pitch implies, all the way to filling
  // the whole screen if pitched to look straight up.
  fillFlatSky(pixels, skyRows) {
    const sky = this.defaultFogColor ?? { r: 70, g: 110, b: 160 };
    for (let y = 0; y < skyRows; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = (y * this.width + x) * 4;
        pixels[index] = sky.r;
        pixels[index + 1] = sky.g;
        pixels[index + 2] = sky.b;
        pixels[index + 3] = 255;
      }
    }
  }

  // Panoramic/cylindrical sky (level.sky configured): fills rows
  // [0, skyRows) with a texture that scrolls horizontally with
  // camera.angle only -- player x/y never enter this calculation, so
  // moving never pans the sky, only turning does. Vertically, the
  // texture is simply stretched to fill the current sky region (no
  // per-row perspective projection -- this is deliberately not a full 3D
  // skybox), so `skyRows` tracks pitch exactly the same way
  // fillFlatSky()'s does, fixing the same cutoff-at-the-horizon issue.
  // Entirely separate from cell geometry/collision/pixelDepth: this never
  // touches the world grid or the depth buffer.
  renderSky(pixels, camera, skyRows) {
    if (skyRows <= 0) return;
    const sky = this.sky;
    const twoPi = Math.PI * 2;

    const textureRows = this.skyRowScratch;
    for (let screenY = 0; screenY < skyRows; screenY++) {
      textureRows[screenY] = Math.max(
        0,
        Math.min(
          sky.heightPixels - 1,
          Math.floor((screenY / skyRows) * sky.heightPixels),
        ),
      );
    }

    for (let screenX = 0; screenX < this.width; screenX++) {
      const angle = camera.angle + this.columnGeometry[screenX].angleOffset;
      const normalizedAngle = ((angle % twoPi) + twoPi) % twoPi;
      const textureX = Math.max(
        0,
        Math.min(
          sky.widthPixels - 1,
          Math.floor((normalizedAngle / twoPi) * sky.widthPixels),
        ),
      );
      for (let screenY = 0; screenY < skyRows; screenY++) {
        const source = (textureRows[screenY] * sky.widthPixels + textureX) * 4;
        const destination = (screenY * this.width + screenX) * 4;
        pixels[destination] = sky.pixels[source];
        pixels[destination + 1] = sky.pixels[source + 1];
        pixels[destination + 2] = sky.pixels[source + 2];
        pixels[destination + 3] = 255;
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

      // A boundary is one or more independent vertical sections (an
      // ordinary full-height wall is just a single section spanning the
      // whole cell -- see normaliseCellDefinition()). Each section is
      // projected and drawn on its own, so an open gap between two
      // sections naturally leaves that screen interval available for
      // whatever is behind this boundary (this cell's own floor/ceiling
      // below, or a further segment through the gap).
      const sections = segment.cell.sections ?? [];
      if (sections.length && segment.entrySide !== null) {
        const distance = this.getCorrectedDistance(
          segment.entryDistance,
          rayAngle,
          camera.angle,
        );
        segment.projectedDistance = distance;
        for (let i = 0; i < sections.length && visibleCount; i++) {
          const section = sections[i];
          if (this.debug) this.debugStats.wallSegments++;
          const top = this.projectWorldZ(section.top, distance);
          const bottom = this.projectWorldZ(section.bottom, distance);
          this.drawWallSection(
            screenX,
            segment,
            section,
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
          if (!visibleCount) break;
          visibleCount = this.drawSectionCaps(
            camera,
            screenX,
            segment,
            sections,
            i,
            rayCos,
            pixels,
            visible,
            visibleCount,
            lighting,
          );
        }
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

  // A section's vertical face alone leaves its horizontal top/bottom
  // undrawn -- a sill has a visible top, a lintel a visible underside,
  // wherever there's actually open space adjacent to draw into. A cap is
  // just a floor/ceiling-shaped plane scoped to this one section's height,
  // so this reuses renderPlane() rather than inventing new geometry: an
  // ordinary full-height wall (one section, `sections[i-1]`/`[i+1]` both
  // absent, its own bottom/top equal to the cell's floor/ceiling) draws
  // zero caps, so this costs nothing for the common case. `sections` is
  // sorted by `bottom` (see normaliseCellDefinition()), so neighbours are
  // just `sections[i - 1]`/`sections[i + 1]`.
  drawSectionCaps(
    camera,
    screenX,
    segment,
    sections,
    index,
    rayCos,
    pixels,
    visible,
    visibleCount,
    lighting,
  ) {
    const section = sections[index];
    const ceilingBound =
      index + 1 < sections.length
        ? sections[index + 1].bottom
        : segment.cell.ceilingHeight;
    if (section.top < ceilingBound) {
      visibleCount = this.renderPlane(
        camera,
        screenX,
        segment,
        section.material,
        section.top,
        rayCos,
        pixels,
        visible,
        visibleCount,
        lighting,
      );
      if (!visibleCount) return visibleCount;
    }
    const floorBound =
      index > 0 ? sections[index - 1].top : segment.cell.floorHeight;
    if (section.bottom > floorBound) {
      visibleCount = this.renderPlane(
        camera,
        screenX,
        segment,
        section.material,
        section.bottom,
        rayCos,
        pixels,
        visible,
        visibleCount,
        lighting,
      );
    }
    return visibleCount;
  }

  // Draws one wall section (see normaliseCellDefinition()). For an
  // ordinary full-height wall this is the only section and behaves
  // identically to the single-wall renderer this replaced -- same work per
  // pixel, just reading `section.bottom/top/material` instead of
  // `segment.cell.floorHeight/ceilingHeight/wall`. Multi-section cells pay
  // for exactly the extra sections they define, nothing more.
  drawWallSection(
    screenX,
    segment,
    section,
    top,
    bottom,
    pixels,
    visible,
    visibleCount,
    lighting,
  ) {
    const material = section.material;
    const start = Math.max(0, Math.ceil(top));
    const end = Math.min(this.height - 1, Math.floor(bottom));
    if (
      !material ||
      start > end ||
      !Number.isFinite(top) ||
      !Number.isFinite(bottom)
    )
      return;
    const sectionHeight = section.top - section.bottom;
    const projectedHeight = bottom - top;
    if (sectionHeight <= 0 || projectedHeight <= 0) return;

    const wallPositionWorld =
      segment.entrySide === 0 ? segment.entryHitY : segment.entryHitX;
    const textureX = Math.max(
      0,
      Math.min(
        material.widthPixels - 1,
        Math.floor(
          (this.wrap(wallPositionWorld, material.width) / material.width) *
            material.widthPixels,
        ),
      ),
    );
    // The whole section sits at one perpendicular depth regardless of row
    // (only its texture row varies), so fog is resolved once per section
    // rather than once per pixel.
    const fog = this.getFogBlend(
      segment.cell.fog,
      segment.projectedDistance ?? segment.entryDistance,
    );
    for (let y = start; y <= end; y++) {
      if (this.debug) this.debugStats.wallPixels++;
      if (!this.isYVisible(visible, visibleCount, y)) continue;
      const position = (y - top) / projectedHeight;
      const worldZ = section.top - position * sectionHeight;
      const textureY = Math.max(
        0,
        Math.min(
          material.heightPixels - 1,
          Math.floor(
            (this.wrap(worldZ - section.bottom, material.height) /
              material.height) *
              material.heightPixels,
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
      this.copyPixel(
        pixels,
        screenX,
        y,
        material,
        textureX,
        textureY,
        light,
        fog,
      );
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
}
