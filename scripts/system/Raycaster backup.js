export class Raycaster {
  constructor(game, level, options = {}) {
    this.game = game;
    this.level = level;

    // ---------------------------------------------------------
    // Renderer
    // ---------------------------------------------------------

    this.width = options.width || 320;
    this.height = options.height || 180;

    // ---------------------------------------------------------
    // World
    // ---------------------------------------------------------

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

    this.focalLength = this.height / 2 / Math.tan(this.fov / 2);

    // ---------------------------------------------------------
    // Framebuffer
    // ---------------------------------------------------------

    this.canvas = document.createElement("canvas");

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.ctx = this.canvas.getContext("2d");

    this.ctx.imageSmoothingEnabled = false;

    this.imageData = this.ctx.createImageData(this.width, this.height);

    // ---------------------------------------------------------
    // Phaser display
    // ---------------------------------------------------------

    this.sprite = this.game.add.sprite(0, 0, null);

    this.texture = this.game.add.bitmapData(this.width, this.height);

    this.sprite.loadTexture(this.texture);

    this.sprite.smoothed = false;

    // ---------------------------------------------------------
    // Cells
    // ---------------------------------------------------------

    this.cells = {};

    this.loadCells();
  }

  // =========================================================
  // CELL / TEXTURE LOADING
  // =========================================================

  loadCells() {
    const definitions = this.level.cells || {};

    for (const id in definitions) {
      const definition = definitions[id];

      this.cells[id] = {
        floorHeight:
          definition.floorHeight ?? this.level.defaultFloorHeight ?? 0,

        ceilingHeight:
          definition.ceilingHeight ??
          this.level.defaultCeilingHeight ??
          this.wallHeight,

        wall: this.loadSurface(definition.wall),

        floor: this.loadSurface(definition.floor),

        ceiling: this.loadSurface(definition.ceiling),
      };
    }
  }

  loadSurface(surface) {
    if (!surface) {
      return null;
    }

    const image = this.game.cache.getImage(surface.texture);

    if (!image) {
      console.warn(`Raycaster: texture "${surface.texture}" not found.`);

      return null;
    }

    const canvas = document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);

    return {
      textureKey: surface.texture,

      width: surface.width || this.cellSize,

      height: surface.height || this.cellSize,

      widthPixels: image.width,
      heightPixels: image.height,

      pixels: imageData.data,
    };
  }

  // =========================================================
  // MAP
  // =========================================================

  getCellId(x, y) {
    const mapX = Math.floor(x);
    const mapY = Math.floor(y);

    if (
      mapX < 0 ||
      mapY < 0 ||
      mapX >= this.level.width ||
      mapY >= this.level.height
    ) {
      return "1";
    }

    return String(this.level.map[mapY][mapX]);
  }

  getCell(x, y) {
    const id = this.getCellId(x, y);

    return this.cells[id] || this.cells["0"];
  }

  isInsideMap(mapX, mapY) {
    return (
      mapX >= 0 &&
      mapY >= 0 &&
      mapX < this.level.width &&
      mapY < this.level.height
    );
  }

  isWall(x, y) {
    const cell = this.getCell(x, y);

    return !!cell?.wall;
  }

  isWallWorld(x, y) {
    return this.isWall(x / this.cellSize, y / this.cellSize);
  }

  // =========================================================
  // PROJECTION
  // =========================================================

  projectHeight(worldHeight, distance) {
    if (distance <= 0) {
      return 0;
    }

    return (worldHeight * this.focalLength) / distance;
  }

  projectWorldZ(worldZ, distance) {
    if (distance <= 0) {
      return this.height / 2;
    }

    return (
      this.height / 2 - this.projectHeight(worldZ - this.cameraHeight, distance)
    );
  }

  // =========================================================
  // FISHEYE CORRECTION
  // =========================================================

  /*
   * DDA gives us distance along the ray.
   *
   * Projection must use distance perpendicular to the
   * camera plane, otherwise walls become stretched toward
   * the edges of the screen.
   */
  getCorrectedDistance(distance, rayAngle, playerAngle) {
    const corrected = distance * Math.cos(rayAngle - playerAngle);

    /*
     * Avoid zero / negative values caused by rays outside
     * the useful FOV or floating point error.
     */
    return Math.max(0.0001, corrected);
  }

  // =========================================================
  // RAY SETUP
  // =========================================================

  createRay(originX, originY, angle) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    let mapX = Math.floor(originX / this.cellSize);

    let mapY = Math.floor(originY / this.cellSize);

    const deltaDistX = dirX === 0 ? Infinity : Math.abs(this.cellSize / dirX);

    const deltaDistY = dirY === 0 ? Infinity : Math.abs(this.cellSize / dirY);

    const stepX = dirX < 0 ? -1 : 1;

    const stepY = dirY < 0 ? -1 : 1;

    let sideDistX;
    let sideDistY;

    if (dirX < 0) {
      sideDistX = (originX - mapX * this.cellSize) / Math.abs(dirX);
    } else {
      sideDistX = ((mapX + 1) * this.cellSize - originX) / Math.abs(dirX);
    }

    if (dirY < 0) {
      sideDistY = (originY - mapY * this.cellSize) / Math.abs(dirY);
    } else {
      sideDistY = ((mapY + 1) * this.cellSize - originY) / Math.abs(dirY);
    }

    return {
      originX,
      originY,

      dirX,
      dirY,

      mapX,
      mapY,

      stepX,
      stepY,

      deltaDistX,
      deltaDistY,

      sideDistX,
      sideDistY,

      distance: 0,
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

  // =========================================================
  // PUBLIC RAYCAST
  // =========================================================

  castRay(originX, originY, angle) {
    const ray = this.createRay(originX, originY, angle);

    const maxSteps = this.level.width * this.level.height * 2 + 4;

    for (let i = 0; i < maxSteps; i++) {
      const boundary = this.stepRay(ray);

      if (boundary.distance > this.maxDistance) {
        return null;
      }

      if (!this.isInsideMap(boundary.mapX, boundary.mapY)) {
        return null;
      }

      const cell = this.getCell(boundary.mapX, boundary.mapY);

      if (cell.wall) {
        return {
          distance: boundary.distance,

          side: boundary.side,

          mapX: boundary.mapX,
          mapY: boundary.mapY,

          hitX: boundary.hitX,
          hitY: boundary.hitY,

          cell,
        };
      }
    }

    return null;
  }

  // =========================================================
  // RENDER
  // =========================================================

  render(player) {
    const pixels = this.imageData.data;

    this.clearFrame(pixels);

    this.renderSky(pixels);

    for (let screenX = 0; screenX < this.width; screenX++) {
      const rayAngle = this.getRayAngle(player.angle, screenX);

      this.renderColumn(player, rayAngle, screenX, pixels);
    }

    this.texture.context.putImageData(this.imageData, 0, 0);

    this.texture.dirty = true;
  }

  // =========================================================
  // SKY
  // =========================================================

  renderSky(pixels) {
    const horizon = Math.floor(this.height / 2);

    for (let y = 0; y < horizon; y++) {
      for (let x = 0; x < this.width; x++) {
        const index = (y * this.width + x) * 4;

        pixels[index] = 70;
        pixels[index + 1] = 110;
        pixels[index + 2] = 160;
        pixels[index + 3] = 255;
      }
    }
  }

  // =========================================================
  // COLUMN
  // =========================================================

  renderColumn(player, rayAngle, screenX, pixels) {
    const ray = this.createRay(player.x, player.y, rayAngle);

    /*
     * This is the distance used for perspective projection.
     *
     * DDA continues to use the uncorrected ray distance.
     */
    const getProjectionDistance = (distance) =>
      this.getCorrectedDistance(distance, rayAngle, player.angle);

    /*
     * Start with the complete vertical screen visible.
     */
    let visibleTop = 0;

    let visibleBottom = this.height - 1;

    const maxSteps = this.level.width * this.level.height * 2 + 4;

    for (let step = 0; step < maxSteps; step++) {
      if (!this.isInsideMap(ray.mapX, ray.mapY)) {
        break;
      }

      const cell = this.getCell(ray.mapX, ray.mapY);

      if (!cell) {
        break;
      }

      const nextDistance = Math.min(ray.sideDistX, ray.sideDistY);

      if (nextDistance > this.maxDistance) {
        break;
      }

      /*
       * Fisheye correction is applied only to projection.
       *
       * DDA geometry remains based on actual ray distance.
       */
      const correctedDistance = getProjectionDistance(nextDistance);

      /*
       * Render the current cell's floor and ceiling.
       */
      const planeResult = this.renderCellPlanes(
        player,
        ray,
        cell,
        nextDistance,
        correctedDistance,
        screenX,
        pixels,
        visibleTop,
        visibleBottom,
      );

      if (planeResult) {
        visibleTop = planeResult.visibleTop;

        visibleBottom = planeResult.visibleBottom;

        if (visibleTop > visibleBottom) {
          return;
        }
      }

      /*
       * Cross the cell boundary.
       */
      const boundary = this.stepRay(ray);

      if (boundary.distance > this.maxDistance) {
        break;
      }

      if (!this.isInsideMap(boundary.mapX, boundary.mapY)) {
        break;
      }

      const nextCell = this.getCell(boundary.mapX, boundary.mapY);

      /*
       * The face belongs to the cell we are entering.
       */
      if (nextCell && nextCell.wall) {
        const wallResult = this.renderWall(
          player,
          rayAngle,
          boundary,
          nextCell,
          screenX,
          pixels,
          visibleTop,
          visibleBottom,
        );

        if (wallResult) {
          visibleTop = wallResult.visibleTop;

          visibleBottom = wallResult.visibleBottom;
        }

        /*
         * If the wall completely occupies the remaining
         * visible range, stop.
         */
        if (visibleTop > visibleBottom) {
          return;
        }
      }
    }
  }

  // =========================================================
  // CELL PLANES
  // =========================================================

  renderCellPlanes(
    player,
    ray,
    cell,
    rayDistance,
    correctedDistance,
    screenX,
    pixels,
    visibleTop,
    visibleBottom,
  ) {
    if (
      rayDistance <= 0 ||
      correctedDistance <= 0 ||
      rayDistance > this.maxDistance
    ) {
      return {
        visibleTop,
        visibleBottom,
      };
    }

    const horizon = this.height / 2;

    /*
     * Projection uses correctedDistance.
     */
    const floorY = this.projectWorldZ(cell.floorHeight, correctedDistance);

    const ceilingY = this.projectWorldZ(cell.ceilingHeight, correctedDistance);

    // -------------------------------------------------------
    // CEILING
    // -------------------------------------------------------

    if (cell.ceiling && cell.ceilingHeight > this.cameraHeight) {
      const start = Math.max(visibleTop, Math.ceil(ceilingY));

      const end = Math.min(visibleBottom, Math.floor(horizon - 1));

      if (start <= end) {
        for (let y = start; y <= end; y++) {
          const world = this.getPlaneWorldPosition(
            player,
            ray,
            y,
            cell.ceilingHeight,
            correctedDistance,
          );

          if (!world) {
            continue;
          }

          this.drawPlanePixel(
            screenX,
            y,
            world.x,
            world.y,
            cell.ceiling,
            pixels,
          );
        }
      }

      /*
       * Do not completely occlude the column.
       *
       * Only the ceiling portion has been resolved.
       */
      visibleTop = Math.max(visibleTop, Math.ceil(ceilingY));
    }

    // -------------------------------------------------------
    // FLOOR
    // -------------------------------------------------------

    if (cell.floor && cell.floorHeight < this.cameraHeight) {
      const start = Math.max(visibleTop, Math.ceil(horizon));

      const end = Math.min(visibleBottom, Math.floor(floorY));

      if (start <= end) {
        for (let y = start; y <= end; y++) {
          const world = this.getPlaneWorldPosition(
            player,
            ray,
            y,
            cell.floorHeight,
            correctedDistance,
          );

          if (!world) {
            continue;
          }

          this.drawPlanePixel(screenX, y, world.x, world.y, cell.floor, pixels);
        }
      }

      visibleBottom = Math.min(visibleBottom, Math.floor(floorY));
    }

    return {
      visibleTop,
      visibleBottom,
    };
  }

  // =========================================================
  // PLANE WORLD POSITION
  // =========================================================

  getPlaneWorldPosition(player, ray, screenY, planeHeight, correctedDistance) {
    const verticalOffset = screenY - this.height / 2;

    if (Math.abs(verticalOffset) < 0.000001) {
      return null;
    }

    /*
     * IMPORTANT:
     *
     * The world position must be found along the actual
     * ray, not along the corrected camera-plane distance.
     *
     * Fisheye correction is for projection only.
     *
     * Therefore we solve the plane intersection using the
     * screen-space vertical angle and then use that distance
     * along the ray.
     */
    const rayDistance = Math.abs(
      ((planeHeight - this.cameraHeight) * this.focalLength) / verticalOffset,
    );

    if (
      !Number.isFinite(rayDistance) ||
      rayDistance <= 0 ||
      rayDistance > this.maxDistance
    ) {
      return null;
    }

    return {
      x: player.x + ray.dirX * rayDistance,

      y: player.y + ray.dirY * rayDistance,

      distance: rayDistance,

      correctedDistance,
    };
  }

  // =========================================================
  // WALL
  // =========================================================

  renderWall(
    player,
    rayAngle,
    boundary,
    cell,
    screenX,
    pixels,
    visibleTop,
    visibleBottom,
  ) {
    const wall = cell.wall;

    if (!wall) {
      return {
        visibleTop,
        visibleBottom,
      };
    }

    const rayDistance = boundary.distance;

    if (rayDistance <= 0 || rayDistance > this.maxDistance) {
      return {
        visibleTop,
        visibleBottom,
      };
    }

    /*
     * -------------------------------------------------------
     * FISHEYE CORRECTION
     * -------------------------------------------------------
     *
     * This is the important part:
     *
     * DDA distance = actual ray length.
     *
     * Projection distance = distance perpendicular to
     * camera plane.
     */
    const correctedDistance = this.getCorrectedDistance(
      rayDistance,
      rayAngle,
      player.angle,
    );

    // -------------------------------------------------------
    // WALL PROJECTION
    // -------------------------------------------------------

    const wallTop = this.projectWorldZ(cell.ceilingHeight, correctedDistance);

    const wallBottom = this.projectWorldZ(cell.floorHeight, correctedDistance);

    let startY = Math.max(visibleTop, Math.ceil(wallTop));

    let endY = Math.min(visibleBottom, Math.floor(wallBottom));

    if (startY > endY) {
      return {
        visibleTop,
        visibleBottom,
      };
    }

    // -------------------------------------------------------
    // TEXTURE X
    // -------------------------------------------------------

    const wallPositionWorld =
      boundary.side === 0 ? boundary.hitY : boundary.hitX;

    const textureWorldX = this.wrap(wallPositionWorld, wall.width);

    let textureX = Math.floor((textureWorldX / wall.width) * wall.widthPixels);

    textureX = Math.max(0, Math.min(wall.widthPixels - 1, textureX));

    // -------------------------------------------------------
    // TEXTURE Y
    // -------------------------------------------------------

    const wallHeight = cell.ceilingHeight - cell.floorHeight;

    if (wallHeight <= 0) {
      return {
        visibleTop,
        visibleBottom,
      };
    }

    const projectedWallHeight = wallBottom - wallTop;

    if (projectedWallHeight <= 0 || !Number.isFinite(projectedWallHeight)) {
      return {
        visibleTop,
        visibleBottom,
      };
    }

    for (let screenY = startY; screenY <= endY; screenY++) {
      const wallPosition = (screenY - wallTop) / projectedWallHeight;

      const worldZ = cell.ceilingHeight - wallPosition * wallHeight;

      const textureWorldY = this.wrap(worldZ - cell.floorHeight, wall.height);

      let textureY = Math.floor(
        (textureWorldY / wall.height) * wall.heightPixels,
      );

      textureY = Math.max(0, Math.min(wall.heightPixels - 1, textureY));

      const sourceIndex = (textureY * wall.widthPixels + textureX) * 4;

      const destinationIndex = (screenY * this.width + screenX) * 4;

      pixels[destinationIndex] = wall.pixels[sourceIndex];

      pixels[destinationIndex + 1] = wall.pixels[sourceIndex + 1];

      pixels[destinationIndex + 2] = wall.pixels[sourceIndex + 2];

      pixels[destinationIndex + 3] = 255;
    }

    // -------------------------------------------------------
    // OCCLUSION
    // -------------------------------------------------------

    /*
     * The wall occupies:
     *
     *     wallTop
     *        ↓
     *        █
     *        █
     *        █
     *        █
     *        █
     *        ↑
     *     wallBottom
     *
     * Anything outside this range remains available to
     * geometry behind the wall.
     */

    if (wallTop <= visibleTop && wallBottom >= visibleBottom) {
      return {
        visibleTop: visibleBottom + 1,

        visibleBottom,
      };
    }

    /*
     * Wall reaches the bottom of the visible region.
     *
     * Preserve the region above the ceiling.
     */
    if (wallBottom >= visibleBottom && wallTop > visibleTop) {
      visibleBottom = Math.floor(wallTop) - 1;
    } else if (wallTop <= visibleTop && wallBottom < visibleBottom) {
      /*
       * Wall reaches the top of the visible region.
       *
       * Preserve the region below the floor.
       */
      visibleTop = Math.ceil(wallBottom) + 1;
    } else if (wallTop > visibleTop && wallBottom < visibleBottom) {
      /*
       * If the wall sits entirely inside the visible interval,
       * preserve the upper region.
       *
       * This is sufficient for the current floor-based walls.
       */
      visibleBottom = Math.floor(wallTop) - 1;
    }

    return {
      visibleTop,
      visibleBottom,
    };
  }

  // =========================================================
  // PLANE PIXEL
  // =========================================================

  drawPlanePixel(screenX, screenY, worldX, worldY, surface, pixels) {
    if (!surface) {
      return;
    }

    const textureWorldX = this.wrap(worldX, surface.width);

    const textureWorldY = this.wrap(worldY, surface.height);

    let textureX = Math.floor(
      (textureWorldX / surface.width) * surface.widthPixels,
    );

    let textureY = Math.floor(
      (textureWorldY / surface.height) * surface.heightPixels,
    );

    textureX = Math.max(0, Math.min(surface.widthPixels - 1, textureX));

    textureY = Math.max(0, Math.min(surface.heightPixels - 1, textureY));

    const sourceIndex = (textureY * surface.widthPixels + textureX) * 4;

    const destinationIndex = (screenY * this.width + screenX) * 4;

    pixels[destinationIndex] = surface.pixels[sourceIndex];

    pixels[destinationIndex + 1] = surface.pixels[sourceIndex + 1];

    pixels[destinationIndex + 2] = surface.pixels[sourceIndex + 2];

    pixels[destinationIndex + 3] = 255;
  }

  // =========================================================
  // RAY ANGLE
  // =========================================================

  getRayAngle(playerAngle, screenX) {
    const cameraX = (screenX - this.width / 2) / (this.width / 2);

    return playerAngle + Math.atan(cameraX * Math.tan(this.fov / 2));
  }

  // =========================================================
  // UTILS
  // =========================================================

  wrap(value, size) {
    if (!size || size <= 0) {
      return 0;
    }

    return ((value % size) + size) % size;
  }

  clearFrame(pixels) {
    pixels.fill(0);

    for (let i = 3; i < pixels.length; i += 4) {
      pixels[i] = 255;
    }
  }

  resizeToCamera() {
    const scaleX = this.game.width / this.width;

    const scaleY = this.game.height / this.height;

    this.sprite.scale.set(scaleX, scaleY);
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
  }
}
