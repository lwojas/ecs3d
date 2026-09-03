import createRaycasterModule from "./wasm/RaycasterRenderer.js";

export class WasmRenderer {
  constructor(state, fallback) {
    this.width = state.width;
    this.height = state.height;
    this.imageData = state.imageData;
    this.cellSize = state.cellSize ?? 4;
    this.maxDistance = state.maxDistance ?? 1000;
    this.cameraHeight = state.cameraHeight ?? 1.25;
    // Same decode-and-cache path SoftwareRenderer.js's sprite rendering
    // uses (game.cache.getImage -> decodeImagePixels), supplied by
    // Raycaster.js -- needed here to lazily resolve a sprite's string
    // `texture` key into decoded pixels the first time that texture is
    // seen, so it can be uploaded and given a numeric id (see
    // resolveSpriteTextureId()). Native code never touches image/Phaser
    // APIs directly; this stays entirely on the JS side of the boundary.
    this.loadSpriteSurface = state.loadSpriteSurface;
    // Decoded panoramic sky surface (Raycaster.js's `this.sky`, or null for
    // the flat-colour background), same shape as a wall/floor/ceiling
    // material -- uploaded once, after the world/material textures, so it
    // gets a texture id that doesn't collide with them. See uploadSky().
    this.sky = state.sky ?? null;
    this.skyTextureId = -1;
    this.fallback = fallback;
    this.module = null;
    this.ready = false;
    this.failed = null;
    this.initializing = this.initialise();
    this.cameraBuffer = new Float32Array(6);
    this.cameraBytes = new Uint8Array(this.cameraBuffer.buffer);
    this.spriteBuffer = new Uint8Array(0);
    this.lightBuffer = new Uint8Array(0);
    this.cameraPointer = 0;
    this.spritePointer = 0;
    this.lightPointer = 0;
    this.materialIds = new Map();
    // Sprite textures share the same native texture-id space as wall/floor/
    // ceiling materials but are resolved lazily, per frame, from whichever
    // string keys camera.sprites actually uses -- see
    // resolveSpriteTextureId(). Reset together with materialIds whenever
    // the world (and therefore the material-texture id range) reloads.
    this.spriteTextureIds = new Map();
    this.nextSpriteTextureId = 0;
    this.worldState = null;
    this.pendingTextures = [];
    this.uploadPointers = new Map();
  }

  async initialise() {
    try {
      const module = await createRaycasterModule();
      module._raycaster_resize(this.width, this.height);
      this.module = module;
      this.cameraPointer = module._malloc(this.cameraBuffer.byteLength);
      module._raycaster_update_config(
        this.cellSize,
        this.maxDistance,
        this.cameraHeight,
      );
      this.ready = true;
      if (this.worldState) this.updateWorldFromState(this.worldState);
      else if (this.worldData) this.updateWorld(this.worldData);
      for (const texture of this.pendingTextures)
        this.updateTexture(...texture);
      this.pendingTextures.length = 0;
      this.uploadSky();
    } catch (error) {
      this.failed = error;
    }
  }

  // Uploads the decoded panoramic sky surface (if any) and tells the
  // native renderer which texture id to use for it -- mirrors
  // SoftwareRenderer.js's constructor-time `this.sky = this.loadSurface(...)`
  // load, just adding the upload step native memory needs. Runs once,
  // after world/material textures are uploaded (see initialise()), so the
  // sky's texture id is assigned after theirs and never collides.
  uploadSky() {
    if (!this.ready) return;
    if (!this.sky) {
      this.module._raycaster_set_sky(-1);
      return;
    }
    this.skyTextureId = this.nextSpriteTextureId++;
    this.updateTexture(
      this.skyTextureId,
      this.sky.widthPixels,
      this.sky.heightPixels,
      this.sky.pixels,
    );
    this.module._raycaster_set_sky(this.skyTextureId);
  }

  renderSnapshot(camera) {
    if (!this.ready) {
      this.fallback.renderSnapshot(camera);
      return;
    }

    this.updateCamera(camera);
    this.updateFrame(camera.sprites, camera.lights, camera.ambient ?? 1);
    this.module._raycaster_render_snapshot(this.cameraPointer);
    const framebuffer = this.getFramebuffer();
    this.imageData.data.set(framebuffer);
    this.drawDebugOverlays(camera);
  }

  // Debug-only overlays (sprite anchor crosshairs, collision-cylinder
  // wireframes) stay JS-only by design -- see wasm-renderer-readme.md --
  // and are drawn straight onto the just-copied WASM framebuffer using
  // `fallback` (the real SoftwareRenderer instance every Raycaster
  // constructs alongside WasmRenderer, sharing this same `imageData`),
  // rather than reimplemented in C++. `updateProjection()` allocates a
  // fresh Float64Array every call (see SoftwareRenderer.js), so it's only
  // paid for when there's actually something to draw, keeping the
  // no-debug-configured case free.
  drawDebugOverlays(camera) {
    const hasAnchors =
      this.fallback.debugSpriteAnchors &&
      camera.sprites &&
      camera.sprites.length > 0;
    const hasWireframes = camera.debugObjects && camera.debugObjects.length > 0;
    if (!hasAnchors && !hasWireframes) return;
    this.fallback.updateProjection(camera);
    if (hasAnchors) {
      this.fallback.renderSpriteAnchors(
        camera,
        camera.sprites,
        this.imageData.data,
      );
    }
    if (hasWireframes) {
      this.fallback.renderDebugWireframes(
        camera,
        camera.debugObjects,
        this.imageData.data,
      );
    }
  }

  pointerFor(bytes) {
    const pointer = this.module._malloc(bytes.byteLength);
    this.module.HEAPU8.set(
      new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      pointer,
    );
    return pointer;
  }

  release(pointer) {
    if (pointer) this.module._free(pointer);
  }

  updateWorld(worldData) {
    this.worldData = worldData;
    if (!this.ready) return;
    const map = this.pointerFor(worldData.map);
    const cells = this.pointerFor(worldData.cells);
    const sections = this.pointerFor(worldData.sections);
    const materials = this.pointerFor(worldData.materials);
    this.module._raycaster_update_world(
      worldData.width,
      worldData.height,
      map,
      worldData.mapCount ?? worldData.map.byteLength / 2,
      cells,
      worldData.cellCount,
      sections,
      worldData.sectionCount,
      materials,
      worldData.materialCount,
    );
    this.release(map);
    this.release(cells);
    this.release(sections);
    this.release(materials);
  }

  updateWorldFromState(state) {
    this.worldState = state;
    this.materialIds.clear();
    const materials = [];
    const textures = [];
    const materialFor = (surface) => {
      if (!surface) return -1;
      let id = this.materialIds.get(surface);
      if (id !== undefined) return id;
      id = materials.length;
      this.materialIds.set(surface, id);
      const textureId = textures.length;
      materials.push({
        texture: textureId,
        width: surface.width,
        height: surface.height,
      });
      textures.push([
        textureId,
        surface.widthPixels,
        surface.heightPixels,
        surface.pixels,
      ]);
      return id;
    };
    const cellCount =
      Math.max(
        256,
        ...Object.keys(state.cells).map(Number).filter(Number.isFinite),
      ) + 1;
    const cellBytes = new Uint8Array(cellCount * 44);
    const sectionRecords = [];
    const cellView = new DataView(cellBytes.buffer);
    Object.entries(state.cells).forEach(([id, cell]) => {
      const cellOffset = Number(id) * 44;
      if (!Number.isFinite(cellOffset) || cellOffset < 0) return;
      const firstSection = sectionRecords.length;
      (cell.sections ?? []).forEach((section) => {
        sectionRecords.push({
          bottom: section.bottom,
          top: section.top,
          material: materialFor(section.material),
        });
      });
      cellView.setFloat32(cellOffset, cell.floorHeight ?? 0, true);
      cellView.setFloat32(cellOffset + 4, cell.ceilingHeight ?? 0, true);
      cellView.setFloat32(cellOffset + 8, cell.fog?.distance ?? 0, true);
      cellView.setInt32(cellOffset + 12, firstSection, true);
      cellView.setInt32(
        cellOffset + 16,
        sectionRecords.length - firstSection,
        true,
      );
      cellView.setInt32(cellOffset + 20, materialFor(cell.floor), true);
      cellView.setInt32(cellOffset + 24, materialFor(cell.ceiling), true);
      cellView.setUint8(cellOffset + 28, cell.blocking ? 1 : 0);
      cellView.setUint8(cellOffset + 29, cell.fog ? 1 : 0);
      cellView.setFloat32(cellOffset + 32, cell.fog?.color?.r ?? 0, true);
      cellView.setFloat32(cellOffset + 36, cell.fog?.color?.g ?? 0, true);
      cellView.setFloat32(cellOffset + 40, cell.fog?.color?.b ?? 0, true);
    });
    const sectionBytes = new Uint8Array(sectionRecords.length * 12);
    const sectionView = new DataView(sectionBytes.buffer);
    sectionRecords.forEach((section, index) => {
      const offset = index * 12;
      sectionView.setFloat32(offset, section.bottom ?? 0, true);
      sectionView.setFloat32(offset + 4, section.top ?? 0, true);
      sectionView.setInt32(offset + 8, section.material, true);
    });
    const materialBytes = new Uint8Array(materials.length * 12);
    const materialView = new DataView(materialBytes.buffer);
    materials.forEach((material, index) => {
      const offset = index * 12;
      materialView.setInt32(offset, material.texture, true);
      materialView.setFloat32(offset + 4, material.width ?? 1, true);
      materialView.setFloat32(offset + 8, material.height ?? 1, true);
    });
    const mapValues = state.map.flat();
    const mapBytes = new Uint8Array(mapValues.length * 2);
    const mapView = new DataView(mapBytes.buffer);
    mapValues.forEach((id, index) =>
      mapView.setUint16(index * 2, Number(id) || 0, true),
    );
    this.updateWorld({
      width: state.level.width,
      height: state.level.height,
      map: mapBytes,
      mapCount: mapValues.length,
      cells: cellBytes,
      cellCount,
      sections: sectionBytes,
      sectionCount: sectionRecords.length,
      materials: materialBytes,
      materialCount: materials.length,
    });
    textures.forEach((texture) => this.updateTexture(...texture));
    // Sprite textures are assigned ids after every material texture this
    // load just claimed, and the sprite-texture cache from any previous
    // world is no longer valid (a reload can reuse/reorder texture ids).
    this.spriteTextureIds.clear();
    this.nextSpriteTextureId = materials.length;
  }

  // Lazily resolves a sprite's string `texture` key to the numeric texture
  // id the native renderer expects (RaycasterSpriteData.texture), decoding
  // and uploading it the first time that key is seen -- mirrors
  // SoftwareRenderer.js's loadSpriteSurface() caching, just adding the
  // upload step needed to hand the pixels to native memory. Returns -1 for
  // an inline texture object/surface (id caching only makes sense for the
  // string-key path) or a texture that fails to load, matching the JS
  // reference's own "no texture -> skip this sprite" behaviour.
  resolveSpriteTextureId(sprite) {
    const key = sprite?.texture;
    if (typeof key !== "string") return -1;
    const cached = this.spriteTextureIds.get(key);
    if (cached !== undefined) return cached;
    const surface = this.loadSpriteSurface?.(key);
    if (!surface) return -1;
    const id = this.nextSpriteTextureId++;
    this.spriteTextureIds.set(key, id);
    this.updateTexture(id, surface.widthPixels, surface.heightPixels, surface.pixels);
    return id;
  }

  updateCellFromState(cellId, cell) {
    if (!this.ready) return;
    const bytes = new Uint8Array(44);
    const view = new DataView(bytes.buffer);
    const sectionBytes = new Uint8Array((cell.sections ?? []).length * 12);
    const sectionView = new DataView(sectionBytes.buffer);
    view.setFloat32(0, cell.floorHeight ?? 0, true);
    view.setFloat32(4, cell.ceilingHeight ?? 0, true);
    view.setFloat32(8, cell.fog?.distance ?? 0, true);
    view.setInt32(12, 0, true);
    view.setInt32(16, (cell.sections ?? []).length, true);
    view.setInt32(20, this.materialIds.get(cell.floor) ?? -1, true);
    view.setInt32(24, this.materialIds.get(cell.ceiling) ?? -1, true);
    view.setUint8(28, cell.blocking ? 1 : 0);
    view.setUint8(29, cell.fog ? 1 : 0);
    view.setFloat32(32, cell.fog?.color?.r ?? 0, true);
    view.setFloat32(36, cell.fog?.color?.g ?? 0, true);
    view.setFloat32(40, cell.fog?.color?.b ?? 0, true);
    (cell.sections ?? []).forEach((section, index) => {
      const offset = index * 12;
      sectionView.setFloat32(offset, section.bottom ?? 0, true);
      sectionView.setFloat32(offset + 4, section.top ?? 0, true);
      sectionView.setInt32(
        offset + 8,
        this.materialIds.get(section.material) ?? -1,
        true,
      );
    });
    this.updateCell(cellId, bytes, sectionBytes);
  }

  updateCell(cellId, cellData, sectionData) {
    if (!this.ready) return;
    const cell = this.pointerFor(cellData);
    const sections = this.pointerFor(sectionData);
    this.module._raycaster_update_cell(
      cellId,
      cell,
      sections,
      sectionData.byteLength / 12,
    );
    this.release(cell);
    this.release(sections);
  }

  updateTexture(id, width, height, pixels) {
    if (!this.ready) {
      this.pendingTextures.push([id, width, height, pixels]);
      return;
    }
    const pointer = this.pointerFor(pixels);
    this.module._raycaster_update_texture(
      id,
      width,
      height,
      pointer,
      pixels.length,
    );
    this.release(pointer);
  }

  updateCamera(camera) {
    this.cameraBuffer[0] = camera.x ?? 0;
    this.cameraBuffer[1] = camera.y ?? 0;
    this.cameraBuffer[2] = camera.z ?? 0;
    this.cameraBuffer[3] = camera.angle ?? 0;
    this.cameraBuffer[4] = camera.pitch ?? 0;
    this.cameraBuffer[5] = camera.fov ?? 0;
    if (this.ready) {
      this.module.HEAPU8.set(this.cameraBytes, this.cameraPointer);
    }
  }

  updateFrame(sprites = [], lights = [], ambient = 1) {
    if (!this.ready) return;
    if (this.spriteBuffer.length < sprites.length * 40) {
      this.spriteBuffer = new Uint8Array(sprites.length * 40);
      this.release(this.spritePointer);
      this.spritePointer = this.module._malloc(this.spriteBuffer.length);
    }
    if (this.lightBuffer.length < lights.length * 32) {
      this.lightBuffer = new Uint8Array(lights.length * 32);
      this.release(this.lightPointer);
      this.lightPointer = this.module._malloc(this.lightBuffer.length);
    }
    const spriteView = new DataView(this.spriteBuffer.buffer);
    sprites.forEach((sprite, index) => {
      const offset = index * 40;
      const scale = sprite.scale ?? 1;
      const scaleX = typeof scale === "number" ? scale : (scale.x ?? 1);
      const scaleY = typeof scale === "number" ? scale : (scale.y ?? scaleX);
      spriteView.setFloat32(offset, sprite.x ?? 0, true);
      spriteView.setFloat32(offset + 4, sprite.y ?? 0, true);
      spriteView.setFloat32(offset + 8, sprite.z ?? 0, true);
      spriteView.setFloat32(offset + 12, sprite.width ?? 1, true);
      spriteView.setFloat32(
        offset + 16,
        sprite.height ?? sprite.width ?? 1,
        true,
      );
      spriteView.setFloat32(offset + 20, scaleX, true);
      spriteView.setFloat32(offset + 24, scaleY, true);
      spriteView.setFloat32(offset + 28, sprite.angle ?? 0, true);
      spriteView.setInt32(offset + 32, this.resolveSpriteTextureId(sprite), true);
      spriteView.setUint8(offset + 36, sprite.billboard === false ? 0 : 1);
    });
    const lightView = new DataView(this.lightBuffer.buffer);
    lights.forEach((light, index) => {
      const offset = index * 32;
      const tint = light.tint ?? {};
      lightView.setFloat32(offset, light.x ?? 0, true);
      lightView.setFloat32(offset + 4, light.y ?? 0, true);
      lightView.setFloat32(offset + 8, light.z ?? 0, true);
      lightView.setFloat32(offset + 12, light.radius ?? 0, true);
      lightView.setFloat32(offset + 16, light.intensity ?? 1, true);
      lightView.setFloat32(offset + 20, (tint.r ?? 255) / 255, true);
      lightView.setFloat32(offset + 24, (tint.g ?? 255) / 255, true);
      lightView.setFloat32(offset + 28, (tint.b ?? 255) / 255, true);
    });
    this.module.HEAPU8.set(this.spriteBuffer, this.spritePointer);
    this.module.HEAPU8.set(this.lightBuffer, this.lightPointer);
    this.module._raycaster_update_frame(
      this.spritePointer,
      sprites.length,
      this.lightPointer,
      lights.length,
      ambient,
    );
  }

  render(player) {
    return this.renderSnapshot(player);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.ready) this.module._raycaster_resize(width, height);
  }

  getFramebuffer() {
    if (!this.ready) return null;
    const pointer = this.module._raycaster_framebuffer();
    const size = this.module._raycaster_framebuffer_size();
    return this.module.HEAPU8.subarray(pointer, pointer + size);
  }

  destroy() {
    if (this.module) {
      this.release(this.cameraPointer);
      this.release(this.spritePointer);
      this.release(this.lightPointer);
      this.module._raycaster_destroy();
      this.module = null;
    }
    this.uploadPointers.clear();
    this.ready = false;
  }
}
