#include "RaycasterRenderer.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <vector>

namespace {
// Mirrors SoftwareRenderer.js's default `visibleIntervalCapacity` (8 pairs).
// Kept as a fixed on-stack array (no heap allocation) since a column's
// visible-interval list never needs to be larger than a handful of open
// gaps between wall sections.
constexpr int kVisibleIntervalCapacity = 8;

std::uint8_t* framebuffer = nullptr;
std::size_t framebufferSize = 0;
std::vector<float> depthBuffer;
int framebufferWidth = 0;
int framebufferHeight = 0;
int worldWidth = 0;
int worldHeight = 0;
std::vector<std::uint16_t> worldMap;
std::vector<RaycasterCellData> cells;
std::vector<RaycasterSectionData> sections;
std::vector<RaycasterMaterialData> materials;
struct Texture {
  int width = 0;
  int height = 0;
  std::vector<std::uint8_t> pixels;
};
std::vector<Texture> textures;
RaycasterCameraData camera{};
std::vector<RaycasterSpriteData> sprites;
std::vector<RaycasterLightData> lights;
float ambient = 1.0f;
float cellSize = 4.0f;
float maxDistance = 1000.0f;
float defaultCameraHeight = 1.25f;
// -1 == no panoramic sky configured (flat-colour background instead) --
// see raycaster_set_sky() / fillTexturedSky().
int skyTexture = -1;
// Per-row sky texture-Y lookup, mirrors SoftwareRenderer.js's
// `skyRowScratch` -- resized (not reallocated per frame) in
// raycaster_resize().
std::vector<int> skyRowScratch;

// One traversed cell boundary along a ray -- mirrors SoftwareRenderer.js's
// traceRay() segment records. Reused across columns via segmentScratch
// below so no per-column/per-ray heap allocation occurs during rendering.
struct Segment {
  const RaycasterCellData* cell;
  int mapX;
  int mapY;
  float entryDistance;
  float exitDistance;
  int entrySide;  // -1 == null (the segment the camera starts inside of).
  float entryHitX;
  float entryHitY;
  float dirX;
  float dirY;
};
std::vector<Segment> segmentScratch;

// Depth-sorted sprite draw order for the current frame -- mirrors
// SoftwareRenderer.js's renderSprites() building `ordered` once per frame.
// Reused across frames (cleared, not reallocated) the same way
// segmentScratch is.
struct SpriteOrderEntry {
  float depth;
  float lateral;
  int index;
};
std::vector<SpriteOrderEntry> spriteDepthOrder;

template <typename T>
T clampValue(T value, T minimum, T maximum) {
  return value < minimum ? minimum : (value > maximum ? maximum : value);
}

float wrapValue(float value, float size) {
  if (size <= 0.0f) return 0.0f;
  const float result = std::fmod(value, size);
  return result < 0.0f ? result + size : result;
}

const RaycasterCellData* cellAt(int x, int y) {
  if (x < 0 || y < 0 || x >= worldWidth || y >= worldHeight) return nullptr;
  const std::size_t index = static_cast<std::size_t>(y) * worldWidth + x;
  if (index >= worldMap.size()) return nullptr;
  const std::uint16_t id = worldMap[index];
  if (id >= cells.size()) return nullptr;
  return &cells[id];
}

void sampleLight(float x, float y, float z, float& red, float& green,
                 float& blue) {
  red = ambient;
  green = ambient;
  blue = ambient;
  for (const auto& light : lights) {
    const float dx = x - light.x;
    const float dy = y - light.y;
    const float dz = z - light.z;
    const float distance = std::sqrt(dx * dx + dy * dy + dz * dz);
    if (distance < light.radius) {
      const float strength = light.intensity * (1.0f - distance / light.radius);
      red += strength * light.tintR;
      green += strength * light.tintG;
      blue += strength * light.tintB;
    }
  }
}

// Mirrors SoftwareRenderer.js's traceRay()/createRay()/stepRay(): grid DDA
// producing every cell boundary the ray crosses, bounded exactly the same
// way (map width*height*2+4 steps, or maxDistance). Rendering (below)
// decides how far into this list it actually needs to look.
void traceRay(float originX, float originY, float dirX, float dirY,
              std::vector<Segment>& segments) {
  segments.clear();
  int mapX = static_cast<int>(std::floor(originX / cellSize));
  int mapY = static_cast<int>(std::floor(originY / cellSize));
  const int stepX = dirX < 0.0f ? -1 : 1;
  const int stepY = dirY < 0.0f ? -1 : 1;
  const float deltaX = dirX == 0.0f ? INFINITY : std::abs(cellSize / dirX);
  const float deltaY = dirY == 0.0f ? INFINITY : std::abs(cellSize / dirY);
  float sideX = dirX < 0.0f
                    ? (originX - mapX * cellSize) / std::abs(dirX)
                    : ((mapX + 1) * cellSize - originX) / std::abs(dirX);
  float sideY = dirY < 0.0f
                    ? (originY - mapY * cellSize) / std::abs(dirY)
                    : ((mapY + 1) * cellSize - originY) / std::abs(dirY);
  int entrySide = -1;
  float entryDistance = 0.0f;
  float entryHitX = originX;
  float entryHitY = originY;
  const int maxSteps = worldWidth * worldHeight * 2 + 4;

  for (int step = 0; step < maxSteps; step++) {
    const RaycasterCellData* cell = cellAt(mapX, mapY);
    if (!cell) break;
    const int currentMapX = mapX;
    const int currentMapY = mapY;

    float distance;
    int side;
    int nextMapX = mapX;
    int nextMapY = mapY;
    if (sideX < sideY) {
      distance = sideX;
      sideX += deltaX;
      nextMapX += stepX;
      side = 0;
    } else {
      distance = sideY;
      sideY += deltaY;
      nextMapY += stepY;
      side = 1;
    }
    const float hitX = originX + dirX * distance;
    const float hitY = originY + dirY * distance;
    const float exitDistance = std::min(distance, maxDistance);

    if (exitDistance > entryDistance) {
      segments.push_back(Segment{cell, currentMapX, currentMapY,
                                  entryDistance, exitDistance, entrySide,
                                  entryHitX, entryHitY, dirX, dirY});
    }
    if (distance >= maxDistance) break;
    if (!cellAt(nextMapX, nextMapY)) break;
    entryDistance = distance;
    entrySide = side;
    entryHitX = hitX;
    entryHitY = hitY;
    mapX = nextMapX;
    mapY = nextMapY;
  }
}

// Mirrors SoftwareRenderer.js's projectWorldZ(): the sole world-Z to
// screen-Y conversion used by walls and planes. `correctedDistance <= 0`
// intentionally falls back to the raw screen half-height, not the
// pitch-shifted horizon -- see SoftwareRenderer.js.
float projectWorldZ(float worldZ, float correctedDistance, float horizon,
                    float cameraZ, float focalLength) {
  if (correctedDistance <= 0.0f) return framebufferHeight / 2.0f;
  return horizon - (worldZ - cameraZ) * focalLength / correctedDistance;
}

float getPlaneScreenY(float planeHeight, float rayDistance, float rayCos,
                      float horizon, float cameraZ, float focalLength) {
  if (rayDistance <= 0.0f) {
    return planeHeight > cameraZ ? -std::numeric_limits<float>::infinity()
                                 : std::numeric_limits<float>::infinity();
  }
  return projectWorldZ(planeHeight, rayDistance * rayCos, horizon, cameraZ,
                       focalLength);
}

// NaN signals "null" (off the horizon row), matching
// getPlaneDistanceAtScreenY()'s `null` return in SoftwareRenderer.js.
float getPlaneDistanceAtScreenY(float planeHeight, int screenY, float rayCos,
                                float horizon, float cameraZ,
                                float focalLength) {
  const float offset = screenY - horizon;
  const float factor =
      std::abs(offset) < 0.000001f ? INFINITY : focalLength / offset;
  if (!std::isfinite(factor)) return std::numeric_limits<float>::quiet_NaN();
  return (std::abs(planeHeight - cameraZ) * std::abs(factor)) /
         std::max(0.0001f, std::abs(rayCos));
}

bool isYVisible(const float* intervals, int count, int y) {
  for (int index = 0; index < count; index++) {
    const int offset = index * 2;
    if (y >= intervals[offset] && y <= intervals[offset + 1]) return true;
  }
  return false;
}

// Direct port of SoftwareRenderer.js's subtractInterval(): removes
// [top, bottom] from the visible-interval list, splitting an interval in
// two if the cut lands strictly inside it. `intervals` holds up to
// kVisibleIntervalCapacity (top, bottom) pairs; once full, a split that
// would need a new slot instead just truncates (matches the JS fallback).
int subtractInterval(float* intervals, int count, float top, float bottom) {
  if (bottom < 0.0f || top >= framebufferHeight ||
      (!std::isfinite(bottom) &&
       bottom != std::numeric_limits<float>::infinity()))
    return count;
  const float cutTop = std::max(0.0f, std::ceil(top));
  const float cutBottom =
      std::min(static_cast<float>(framebufferHeight - 1), std::floor(bottom));
  if (cutTop > cutBottom) return count;

  for (int index = 0; index < count; index++) {
    const int offset = index * 2;
    const float intervalTop = intervals[offset];
    const float intervalBottom = intervals[offset + 1];

    if (cutBottom < intervalTop || cutTop > intervalBottom) continue;

    const bool hasUpper = cutTop > intervalTop;
    const bool hasLower = cutBottom < intervalBottom;

    if (hasUpper && hasLower) {
      if (count >= kVisibleIntervalCapacity) {
        intervals[offset + 1] = cutTop - 1;
        return count;
      }
      for (int move = count; move > index + 1; move--) {
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

    for (int move = index; move < count - 1; move++) {
      intervals[move * 2] = intervals[(move + 1) * 2];
      intervals[move * 2 + 1] = intervals[(move + 1) * 2 + 1];
    }
    count--;
    index--;
  }
  return count;
}

// Mirrors SoftwareRenderer.js's renderPlane()/drawPlanePixel(): projects a
// horizontal plane (floor, ceiling, or a section cap) across the screen
// rows the current segment's distance range actually covers, sampling
// texture/lighting/fog per pixel. Unlike walls, plane pixels do not read or
// write the depth buffer -- see drawWallSection() and the class comment in
// SoftwareRenderer.js above renderPlane().
int renderPlane(const RaycasterCameraData* value, int screenX,
                const Segment& segment, int materialId, float planeHeight,
                float rayCos, float* visible, int visibleCount, float horizon,
                float focalLength) {
  if (visibleCount <= 0) return visibleCount;
  if (materialId < 0 || materialId >= static_cast<int>(materials.size()))
    return visibleCount;
  if (planeHeight == value->z) return visibleCount;
  const auto& material = materials[materialId];
  if (material.texture < 0 ||
      material.texture >= static_cast<int>(textures.size()))
    return visibleCount;
  const auto& texture = textures[material.texture];
  if (texture.width <= 0 || texture.height <= 0) return visibleCount;

  const float entryScreenY = getPlaneScreenY(planeHeight, segment.entryDistance,
                                             rayCos, horizon, value->z,
                                             focalLength);
  const float exitScreenY = getPlaneScreenY(planeHeight, segment.exitDistance,
                                            rayCos, horizon, value->z,
                                            focalLength);
  const float planeTop = std::min(entryScreenY, exitScreenY);
  const float planeBottom = std::max(entryScreenY, exitScreenY);
  const int start = std::max(0, static_cast<int>(std::ceil(planeTop)));
  const int end = std::min(framebufferHeight - 1,
                           static_cast<int>(std::floor(planeBottom)));
  const RaycasterCellData* cell = segment.cell;

  for (int y = start; y <= end; y++) {
    if (!isYVisible(visible, visibleCount, y)) continue;
    const float distance = getPlaneDistanceAtScreenY(
        planeHeight, y, rayCos, horizon, value->z, focalLength);
    if (std::isnan(distance) || distance < segment.entryDistance - 0.0001f ||
        distance > segment.exitDistance + 0.0001f)
      continue;
    const float worldX = value->x + segment.dirX * distance;
    const float worldY = value->y + segment.dirY * distance;
    const int textureX = clampValue(
        static_cast<int>((wrapValue(worldX, material.width) / material.width) *
                         texture.width),
        0, texture.width - 1);
    const int textureY = clampValue(
        static_cast<int>(
            (wrapValue(worldY, material.height) / material.height) *
            texture.height),
        0, texture.height - 1);
    const std::size_t source =
        (static_cast<std::size_t>(textureY) * texture.width + textureX) * 4;
    if (source + 3 >= texture.pixels.size()) continue;
    float lightR;
    float lightG;
    float lightB;
    sampleLight(worldX, worldY, planeHeight, lightR, lightG, lightB);
    const float fog = cell->fogEnabled && cell->fogDistance > 0.0f
                          ? std::min(1.0f, distance / cell->fogDistance)
                          : 0.0f;
    const std::size_t destination =
        (static_cast<std::size_t>(y) * framebufferWidth + screenX) * 4;
    for (int channel = 0; channel < 3; channel++) {
      const float texValue = texture.pixels[source + channel];
      const float light = channel == 0 ? lightR
                                       : (channel == 1 ? lightG : lightB);
      const float fogColor =
          channel == 0 ? cell->fogR : (channel == 1 ? cell->fogG : cell->fogB);
      framebuffer[destination + channel] = static_cast<std::uint8_t>(
          clampValue(texValue * light * (1.0f - fog) + fogColor * fog, 0.0f,
                    255.0f));
    }
    framebuffer[destination + 3] = 255;
  }
  return subtractInterval(visible, visibleCount, planeTop, planeBottom);
}

// Mirrors SoftwareRenderer.js's drawWallSection(): draws one vertical wall
// section's visible rows and records the nearest depth reached, but -- like
// the JS reference -- only the visible-interval list gates which rows are
// drawn; the depth buffer itself is written (via min()), not pre-checked,
// since interval subtraction already prevents a farther segment from
// redrawing rows a nearer one already claimed.
void drawWallSection(int screenX, const Segment& segment,
                     const RaycasterSectionData& section, float top,
                     float bottom, const float* visible, int visibleCount,
                     float projectedDistance) {
  if (section.material < 0 ||
      section.material >= static_cast<int>(materials.size()))
    return;
  const auto& material = materials[section.material];
  if (material.texture < 0 ||
      material.texture >= static_cast<int>(textures.size()))
    return;
  const auto& texture = textures[material.texture];
  if (texture.width <= 0 || texture.height <= 0) return;

  const int start = std::max(0, static_cast<int>(std::ceil(top)));
  const int end = std::min(framebufferHeight - 1,
                           static_cast<int>(std::floor(bottom)));
  if (start > end || !std::isfinite(top) || !std::isfinite(bottom)) return;
  const float sectionHeight = section.top - section.bottom;
  const float projectedHeight = bottom - top;
  if (sectionHeight <= 0.0f || projectedHeight <= 0.0f) return;

  const float wallPositionWorld =
      segment.entrySide == 0 ? segment.entryHitY : segment.entryHitX;
  const int textureX = clampValue(
      static_cast<int>((wrapValue(wallPositionWorld, material.width) /
                        material.width) *
                       texture.width),
      0, texture.width - 1);
  const RaycasterCellData* cell = segment.cell;
  const float fog = cell->fogEnabled && cell->fogDistance > 0.0f
                        ? std::min(1.0f, projectedDistance / cell->fogDistance)
                        : 0.0f;

  for (int y = start; y <= end; y++) {
    if (!isYVisible(visible, visibleCount, y)) continue;
    const float position = (y - top) / projectedHeight;
    const float worldZ = section.top - position * sectionHeight;
    const int textureY = clampValue(
        static_cast<int>(
            (wrapValue(worldZ - section.bottom, material.height) /
             material.height) *
            texture.height),
        0, texture.height - 1);
    const std::size_t source =
        (static_cast<std::size_t>(textureY) * texture.width + textureX) * 4;
    if (source + 3 >= texture.pixels.size()) continue;
    float lightR;
    float lightG;
    float lightB;
    sampleLight(segment.entryHitX, segment.entryHitY, worldZ, lightR, lightG,
               lightB);
    const std::size_t depthIndex =
        static_cast<std::size_t>(y) * framebufferWidth + screenX;
    const std::size_t destination = depthIndex * 4;
    for (int channel = 0; channel < 3; channel++) {
      const float texValue = texture.pixels[source + channel];
      const float light = channel == 0 ? lightR
                                       : (channel == 1 ? lightG : lightB);
      const float fogColor =
          channel == 0 ? cell->fogR : (channel == 1 ? cell->fogG : cell->fogB);
      framebuffer[destination + channel] = static_cast<std::uint8_t>(
          clampValue(texValue * light * (1.0f - fog) + fogColor * fog, 0.0f,
                    255.0f));
    }
    framebuffer[destination + 3] = 255;
    depthBuffer[depthIndex] = std::min(depthBuffer[depthIndex], projectedDistance);
  }
}

// Mirrors SoftwareRenderer.js's drawSectionCaps(): a section's sill top /
// lintel underside is just a plane scoped to that one section's height, open
// only where an adjacent section (or the cell's own floor/ceiling) doesn't
// already cover it. Sections within [first, first+sectionCount) are sorted
// bottom-to-top (see Raycaster.js's normaliseCellDefinition()), so neighbours
// are simply index-1/index+1.
int drawSectionCaps(const RaycasterCameraData* value, int screenX,
                    const Segment& segment, int first, int sectionCount,
                    int index, float rayCos, float* visible, int visibleCount,
                    float horizon, float focalLength) {
  const auto& section = sections[first + index];
  const RaycasterCellData* cell = segment.cell;
  const float ceilingBound = index + 1 < sectionCount
                                 ? sections[first + index + 1].bottom
                                 : cell->ceilingHeight;
  if (section.top < ceilingBound) {
    visibleCount = renderPlane(value, screenX, segment, section.material,
                               section.top, rayCos, visible, visibleCount,
                               horizon, focalLength);
    if (!visibleCount) return visibleCount;
  }
  const float floorBound =
      index > 0 ? sections[first + index - 1].top : cell->floorHeight;
  if (section.bottom > floorBound) {
    visibleCount = renderPlane(value, screenX, segment, section.material,
                               section.bottom, rayCos, visible, visibleCount,
                               horizon, focalLength);
  }
  return visibleCount;
}

// Mirrors SoftwareRenderer.js's getSpriteCameraSpace(): `lateral` is the
// camera-right offset, `depth` is the forward-axis (not Euclidean)
// distance.
void getSpriteCameraSpace(float spriteX, float spriteY,
                          const RaycasterCameraData* value, float cameraSin,
                          float cameraCos, float& lateral, float& depth) {
  const float dx = spriteX - value->x;
  const float dy = spriteY - value->y;
  lateral = -dx * cameraSin + dy * cameraCos;
  depth = dx * cameraCos + dy * cameraSin;
}

float projectLateralToScreenX(float lateral, float depth, float focalLength) {
  return framebufferWidth / 2.0f + (lateral * focalLength) / depth;
}

// Per-pixel sprite colour resolution shared by billboards and oriented
// sprites -- both sample one texel, apply the sprite's (already-resolved)
// light multiplier and optional fog blend, and preserve source alpha
// exactly like SoftwareRenderer.js's copySpritePixel(). Bundling
// light+fog here, rather than duplicating this loop in each caller, is the
// only thing that changed from a literal per-function port -- the
// arithmetic is identical to the JS reference.
struct SpriteBlend {
  float lightR;
  float lightG;
  float lightB;
  bool hasFog;
  float fog;
  float fogR;
  float fogG;
  float fogB;
};

SpriteBlend resolveSpriteLight(float worldX, float worldY, float worldZ) {
  SpriteBlend blend{};
  sampleLight(worldX, worldY, worldZ, blend.lightR, blend.lightG, blend.lightB);
  return blend;
}

void resolveSpriteFog(SpriteBlend& blend, const RaycasterCellData* cell,
                      float depth) {
  blend.hasFog = cell && cell->fogEnabled && cell->fogDistance > 0.0f;
  blend.fog = blend.hasFog ? std::min(1.0f, depth / cell->fogDistance) : 0.0f;
  blend.fogR = cell ? cell->fogR : 0.0f;
  blend.fogG = cell ? cell->fogG : 0.0f;
  blend.fogB = cell ? cell->fogB : 0.0f;
}

void drawSpritePixel(std::size_t depthIndex, const Texture& texture,
                     std::size_t source, const SpriteBlend& blend) {
  if (source + 3 >= texture.pixels.size()) return;
  const std::uint8_t alpha = texture.pixels[source + 3];
  if (alpha == 0) return;
  const std::size_t destination = depthIndex * 4;
  for (int channel = 0; channel < 3; channel++) {
    float texValue = texture.pixels[source + channel];
    const float light = channel == 0 ? blend.lightR
                                     : (channel == 1 ? blend.lightG : blend.lightB);
    texValue *= light;
    if (blend.hasFog) {
      const float fogColor =
          channel == 0 ? blend.fogR : (channel == 1 ? blend.fogG : blend.fogB);
      texValue += (fogColor - texValue) * blend.fog;
    }
    framebuffer[destination + channel] =
        static_cast<std::uint8_t>(clampValue(texValue, 0.0f, 255.0f));
  }
  framebuffer[destination + 3] = alpha;
}

// Mirrors SoftwareRenderer.js's renderBillboard()/projectBillboard(): projects
// a flat, camera-facing sprite quad and draws it depth-tested against (but
// not written into) the wall depth buffer -- sprite-vs-sprite ordering
// instead comes from the caller drawing farthest-to-nearest (see the sprite
// pass in raycaster_render_snapshot()).
void renderBillboardSprite(const RaycasterCameraData* value,
                           const RaycasterSpriteData& sprite, float lateral,
                           float depth, float horizon, float focalLength) {
  if (sprite.texture < 0 || sprite.texture >= static_cast<int>(textures.size()))
    return;
  const auto& texture = textures[sprite.texture];
  if (texture.width <= 0 || texture.height <= 0) return;

  const float centerX = projectLateralToScreenX(lateral, depth, focalLength);
  const float worldWidth = sprite.width * sprite.scaleX;
  const float worldHeight = sprite.height * sprite.scaleY;
  const float projectedWidth = worldWidth * focalLength / depth;
  const float projectedHeight = worldHeight * focalLength / depth;
  if (projectedWidth <= 0.0f || projectedHeight <= 0.0f) return;

  const float leftF = centerX - projectedWidth / 2.0f;
  const float rightF = centerX + projectedWidth / 2.0f;
  const float bottom =
      projectWorldZ(sprite.z, depth, horizon, value->z, focalLength);
  const float top = bottom - projectedHeight;

  const int startX = std::max(0, static_cast<int>(std::ceil(leftF)));
  const int endX = std::min(framebufferWidth - 1,
                            static_cast<int>(std::floor(rightF)));
  const int startY = std::max(0, static_cast<int>(std::ceil(top)));
  const int endY = std::min(framebufferHeight - 1,
                            static_cast<int>(std::floor(bottom)));
  if (startX > endX || startY > endY) return;

  const RaycasterCellData* cell =
      cellAt(static_cast<int>(std::floor(sprite.x / cellSize)),
            static_cast<int>(std::floor(sprite.y / cellSize)));
  // Lighting and fog are resolved once for the whole sprite (a flat
  // billboard has no per-pixel world depth of its own), not per pixel --
  // same as SoftwareRenderer.js's renderBillboard().
  SpriteBlend blend = resolveSpriteLight(sprite.x, sprite.y, sprite.z);
  resolveSpriteFog(blend, cell, depth);
  const float widthScale = texture.width / std::max(1.0f, rightF - leftF + 1.0f);
  const float heightScale =
      texture.height / std::max(1.0f, bottom - top + 1.0f);

  for (int screenX = startX; screenX <= endX; screenX++) {
    const int textureX = clampValue(
        static_cast<int>((screenX - leftF) * widthScale), 0, texture.width - 1);
    for (int screenY = startY; screenY <= endY; screenY++) {
      const std::size_t depthIndex =
          static_cast<std::size_t>(screenY) * framebufferWidth + screenX;
      if (depthBuffer[depthIndex] <= depth) continue;
      const int textureY = clampValue(
          static_cast<int>((screenY - top) * heightScale), 0,
          texture.height - 1);
      const std::size_t source =
          (static_cast<std::size_t>(textureY) * texture.width + textureX) * 4;
      drawSpritePixel(depthIndex, texture, source, blend);
    }
  }
}

// Mirrors SoftwareRenderer.js's renderOrientedSprite(): the sprite is a
// world-space quad (its own left/right edges independently projected, not a
// screen-facing billboard), so texture U and depth both vary perspective-
// correctly across its width. Same interpolation SoftwareRenderer.js uses,
// restructured to divide once per sprite (`invLeftDepth`/`invRightDepth`)
// instead of re-dividing by those same two constants on every column, and
// to reuse the just-computed `depth` (a multiply) for the texture-U step
// instead of a second division -- same result, fewer divisions in the hot
// per-column loop. No near-plane clip yet (an edge behind the camera drops
// the sprite for this frame), matching the JS reference exactly.
void renderOrientedSprite(const RaycasterCameraData* value,
                          const RaycasterSpriteData& sprite, float cameraSin,
                          float cameraCos, float horizon, float focalLength) {
  if (sprite.texture < 0 || sprite.texture >= static_cast<int>(textures.size()))
    return;
  const auto& texture = textures[sprite.texture];
  if (texture.width <= 0 || texture.height <= 0) return;

  const float worldWidth = sprite.width * sprite.scaleX;
  const float worldHeight = sprite.height * sprite.scaleY;
  const float halfWidth = worldWidth / 2.0f;
  // `angle` is the direction the sprite's front face points; its
  // horizontal axis runs perpendicular to that.
  const float axisX = -std::sin(sprite.angle);
  const float axisY = std::cos(sprite.angle);

  float leftLateral;
  float leftDepth;
  getSpriteCameraSpace(sprite.x - axisX * halfWidth, sprite.y - axisY * halfWidth,
                       value, cameraSin, cameraCos, leftLateral, leftDepth);
  float rightLateral;
  float rightDepth;
  getSpriteCameraSpace(sprite.x + axisX * halfWidth, sprite.y + axisY * halfWidth,
                       value, cameraSin, cameraCos, rightLateral, rightDepth);
  if (leftDepth <= 0.0001f || rightDepth <= 0.0001f) return;

  const float leftScreenX =
      projectLateralToScreenX(leftLateral, leftDepth, focalLength);
  const float rightScreenX =
      projectLateralToScreenX(rightLateral, rightDepth, focalLength);
  const float xDirection = rightScreenX - leftScreenX;
  if (std::abs(xDirection) < 0.0001f) return;

  const int startX = std::max(
      0, static_cast<int>(std::ceil(std::min(leftScreenX, rightScreenX))));
  const int endX = std::min(
      framebufferWidth - 1,
      static_cast<int>(std::floor(std::max(leftScreenX, rightScreenX))));
  if (startX > endX) return;

  const RaycasterCellData* cell =
      cellAt(static_cast<int>(std::floor(sprite.x / cellSize)),
            static_cast<int>(std::floor(sprite.y / cellSize)));
  // Light depends only on the sprite's own position/height, not on which
  // column is being drawn, so (like the billboard path) it is resolved
  // once for the whole sprite; fog varies with each column's perspective-
  // correct depth, so it's re-resolved inside the loop below.
  SpriteBlend blend = resolveSpriteLight(sprite.x, sprite.y, sprite.z);
  const float invLeftDepth = 1.0f / leftDepth;
  const float invRightDepth = 1.0f / rightDepth;

  for (int screenX = startX; screenX <= endX; screenX++) {
    const float screenT = (screenX - leftScreenX) / xDirection;
    const float invDepth =
        (1.0f - screenT) * invLeftDepth + screenT * invRightDepth;
    if (invDepth <= 0.000001f) continue;
    const float depth = 1.0f / invDepth;
    const float textureT = screenT * invRightDepth * depth;
    const int textureX =
        clampValue(static_cast<int>(textureT * texture.width), 0,
                  texture.width - 1);

    const float bottom =
        projectWorldZ(sprite.z, depth, horizon, value->z, focalLength);
    const float top = projectWorldZ(sprite.z + worldHeight, depth, horizon,
                                    value->z, focalLength);
    const int startY =
        std::max(0, static_cast<int>(std::ceil(std::min(top, bottom))));
    const int endY = std::min(
        framebufferHeight - 1,
        static_cast<int>(std::floor(std::max(top, bottom))));
    if (startY > endY) continue;

    resolveSpriteFog(blend, cell, depth);
    const float heightScale = texture.height / std::max(1.0f, bottom - top);

    for (int screenY = startY; screenY <= endY; screenY++) {
      const std::size_t depthIndex =
          static_cast<std::size_t>(screenY) * framebufferWidth + screenX;
      if (depthBuffer[depthIndex] <= depth) continue;
      const int textureY = clampValue(
          static_cast<int>((screenY - top) * heightScale), 0,
          texture.height - 1);
      const std::size_t source =
          (static_cast<std::size_t>(textureY) * texture.width + textureX) * 4;
      drawSpritePixel(depthIndex, texture, source, blend);
    }
  }
}

// Mirrors SoftwareRenderer.js's renderSky(): a panoramic sky texture that
// scrolls horizontally with `camera.angle` alone (world x/y never enter
// the calculation, so moving never pans it, only turning does) and is
// simply stretched vertically to fill the current sky region -- not a
// full 3D skybox, same deliberate simplification the JS reference makes.
// No lighting/fog/depth test applies to sky pixels, matching JS exactly.
void fillTexturedSky(const RaycasterCameraData* value, int skyRows,
                     float halfWidth, float fovScale) {
  const auto& texture = textures[skyTexture];
  constexpr float kTwoPi = 6.283185307179586f;

  for (int screenY = 0; screenY < skyRows; screenY++) {
    skyRowScratch[screenY] = clampValue(
        static_cast<int>((static_cast<float>(screenY) / skyRows) *
                         texture.height),
        0, texture.height - 1);
  }

  for (int screenX = 0; screenX < framebufferWidth; screenX++) {
    const float cameraX = (screenX - halfWidth) / halfWidth;
    const float angleOffset = std::atan(cameraX * fovScale);
    const float angle = value->angle + angleOffset;
    float normalizedAngle = std::fmod(angle, kTwoPi);
    if (normalizedAngle < 0.0f) normalizedAngle += kTwoPi;
    const int textureX = clampValue(
        static_cast<int>((normalizedAngle / kTwoPi) * texture.width), 0,
        texture.width - 1);
    for (int screenY = 0; screenY < skyRows; screenY++) {
      const std::size_t source =
          (static_cast<std::size_t>(skyRowScratch[screenY]) * texture.width +
           textureX) *
          4;
      const std::size_t destination =
          (static_cast<std::size_t>(screenY) * framebufferWidth + screenX) * 4;
      framebuffer[destination] = texture.pixels[source];
      framebuffer[destination + 1] = texture.pixels[source + 1];
      framebuffer[destination + 2] = texture.pixels[source + 2];
      framebuffer[destination + 3] = 255;
    }
  }
}
}

extern "C" {

void raycaster_resize(int width, int height) {
  if (width <= 0 || height <= 0) return;
  const std::size_t size = static_cast<std::size_t>(width) *
                           static_cast<std::size_t>(height) * 4;
  if (size != framebufferSize) {
    std::free(framebuffer);
    framebuffer = static_cast<std::uint8_t*>(std::malloc(size));
    framebufferSize = framebuffer ? size : 0;
  }
  framebufferWidth = framebuffer ? width : 0;
  framebufferHeight = framebuffer ? height : 0;
  depthBuffer.resize(static_cast<std::size_t>(width) * height);
  skyRowScratch.resize(static_cast<std::size_t>(height));
  raycaster_reset_depth();
}

std::uintptr_t raycaster_framebuffer() {
  return reinterpret_cast<std::uintptr_t>(framebuffer);
}

std::size_t raycaster_framebuffer_size() { return framebufferSize; }

void raycaster_clear(std::uint8_t red, std::uint8_t green, std::uint8_t blue,
                     std::uint8_t alpha) {
  if (!framebuffer) return;
  for (std::size_t index = 0; index < framebufferSize; index += 4) {
    framebuffer[index] = red;
    framebuffer[index + 1] = green;
    framebuffer[index + 2] = blue;
    framebuffer[index + 3] = alpha;
  }
}

void raycaster_reset_depth() {
  std::fill(depthBuffer.begin(), depthBuffer.end(),
            std::numeric_limits<float>::infinity());
}

std::uintptr_t raycaster_depth_buffer() {
  return reinterpret_cast<std::uintptr_t>(depthBuffer.data());
}

std::size_t raycaster_depth_buffer_size() {
  return depthBuffer.size() * sizeof(float);
}

void raycaster_update_world(int width, int height, const std::uint16_t* map,
                            std::size_t mapCount,
                            const RaycasterCellData* newCells, int cellCount,
                            const RaycasterSectionData* newSections,
                            int sectionCount,
                            const RaycasterMaterialData* newMaterials,
                            int materialCount) {
  worldWidth = width;
  worldHeight = height;
  worldMap.clear();
  cells.clear();
  sections.clear();
  materials.clear();
  if (map && mapCount) worldMap.assign(map, map + mapCount);
  if (newCells && cellCount > 0) cells.assign(newCells, newCells + cellCount);
  if (newSections && sectionCount > 0)
    sections.assign(newSections, newSections + sectionCount);
  if (newMaterials && materialCount > 0)
    materials.assign(newMaterials, newMaterials + materialCount);
  // Bounds traceRay() the same way SoftwareRenderer.js's own maxSteps does,
  // so segmentScratch never needs to grow (reallocate) mid-render.
  segmentScratch.reserve(
      static_cast<std::size_t>(std::max(0, worldWidth)) *
          static_cast<std::size_t>(std::max(0, worldHeight)) * 2 +
      4);
}

void raycaster_update_cell(int cellId, const RaycasterCellData* cell,
                           const RaycasterSectionData* newSections,
                           int sectionCount) {
  if (!cell || cellId < 0) return;
  if (cellId >= static_cast<int>(cells.size())) cells.resize(cellId + 1);
  RaycasterCellData updated = *cell;
  const int requestedCount = std::max(0, sectionCount);
  const RaycasterCellData previous = cells[cellId];
  if (requestedCount <= previous.sectionCount) {
    updated.firstSection = previous.firstSection;
  } else {
    updated.firstSection = static_cast<int>(sections.size());
  }
  updated.sectionCount = requestedCount;
  cells[cellId] = updated;
  if (!newSections || requestedCount == 0) return;
  if (updated.firstSection == static_cast<int>(sections.size())) {
    sections.insert(sections.end(), newSections, newSections + requestedCount);
  } else {
    std::copy(newSections, newSections + requestedCount,
              sections.begin() + updated.firstSection);
  }
}

void raycaster_update_texture(int id, int width, int height,
                              const std::uint8_t* pixels,
                              std::size_t pixelCount) {
  if (id < 0 || width <= 0 || height <= 0 || !pixels) return;
  if (id >= static_cast<int>(textures.size())) textures.resize(id + 1);
  textures[id].width = width;
  textures[id].height = height;
  textures[id].pixels.assign(pixels, pixels + pixelCount);
}

void raycaster_update_camera(const RaycasterCameraData* value) {
  if (value) camera = *value;
}

void raycaster_update_config(float valueCellSize, float valueMaxDistance,
                             float valueCameraHeight) {
  if (valueCellSize > 0.0f) cellSize = valueCellSize;
  if (valueMaxDistance > 0.0f) maxDistance = valueMaxDistance;
  defaultCameraHeight = valueCameraHeight;
}

void raycaster_update_frame(const RaycasterSpriteData* newSprites,
                            int spriteCount,
                            const RaycasterLightData* newLights,
                            int lightCount, float newAmbient) {
  sprites.clear();
  lights.clear();
  if (newSprites && spriteCount > 0)
    sprites.assign(newSprites, newSprites + spriteCount);
  if (newLights && lightCount > 0)
    lights.assign(newLights, newLights + lightCount);
  ambient = newAmbient;
  spriteDepthOrder.reserve(sprites.size());
}

void raycaster_set_sky(int textureId) { skyTexture = textureId; }

// Mirrors SoftwareRenderer.js's renderSnapshot()/renderColumn(): per column,
// trace every cell boundary the ray crosses, then walk those segments
// drawing each one's wall sections (+ their sill/lintel caps) and its own
// cell's floor/ceiling, tracking which screen rows remain undrawn via a
// per-column visible-interval list exactly like the JS reference. No
// per-pixel or per-column callback into JavaScript occurs anywhere in this
// loop.
void raycaster_render_snapshot(const RaycasterCameraData* value) {
  raycaster_update_camera(value);
  if (!framebuffer || !value || framebufferWidth <= 0 || framebufferHeight <= 0)
    return;

  const float fov = value->fov > 0.0f ? value->fov : 1.0471975512f;
  const float focalLength = framebufferWidth / 2.0f / std::tan(fov / 2.0f);
  const float horizon = framebufferHeight / 2.0f + value->pitch;

  const float halfWidth = framebufferWidth / 2.0f;
  const float fovScale = std::tan(fov / 2.0f);

  // Background: sky rows come from either the panoramic sky texture (if
  // `level.sky` is configured -- see fillTexturedSky()) or a flat colour;
  // rows below the horizon stay transparent either way, exactly mirroring
  // SoftwareRenderer.js's pixels.fill(0) + (renderSky()/fillFlatSky()).
  const int skyRows =
      std::max(0, std::min(framebufferHeight,
                           static_cast<int>(std::ceil(horizon))));
  const bool useTexturedSky =
      skyTexture >= 0 && skyTexture < static_cast<int>(textures.size()) &&
      textures[skyTexture].width > 0 && textures[skyTexture].height > 0;
  if (useTexturedSky) fillTexturedSky(value, skyRows, halfWidth, fovScale);
  for (int y = useTexturedSky ? skyRows : 0; y < framebufferHeight; y++) {
    const bool isFlatSky = !useTexturedSky && y < skyRows;
    for (int x = 0; x < framebufferWidth; x++) {
      const std::size_t index =
          (static_cast<std::size_t>(y) * framebufferWidth + x) * 4;
      if (isFlatSky) {
        framebuffer[index] = 70;
        framebuffer[index + 1] = 110;
        framebuffer[index + 2] = 160;
        framebuffer[index + 3] = 255;
      } else {
        framebuffer[index] = 0;
        framebuffer[index + 1] = 0;
        framebuffer[index + 2] = 0;
        framebuffer[index + 3] = 0;
      }
    }
  }
  raycaster_reset_depth();

  float visible[kVisibleIntervalCapacity * 2];

  for (int screenX = 0; screenX < framebufferWidth; screenX++) {
    const float cameraX = (screenX - halfWidth) / halfWidth;
    const float angleOffset = std::atan(cameraX * fovScale);
    const float rayAngle = value->angle + angleOffset;
    const float dirX = std::cos(rayAngle);
    const float dirY = std::sin(rayAngle);
    const float rayCos = std::cos(angleOffset);

    traceRay(value->x, value->y, dirX, dirY, segmentScratch);

    visible[0] = 0.0f;
    visible[1] = static_cast<float>(framebufferHeight - 1);
    int visibleCount = 1;

    for (const Segment& segment : segmentScratch) {
      if (!visibleCount) break;
      const RaycasterCellData* cell = segment.cell;

      if (cell->sectionCount > 0 && segment.entrySide >= 0) {
        const float distance =
            std::max(0.0001f, segment.entryDistance * std::cos(angleOffset));
        const int first = std::max(0, cell->firstSection);
        const int last =
            std::min(static_cast<int>(sections.size()), first + cell->sectionCount);
        const int sectionCount = last - first;
        for (int sectionIndex = first; sectionIndex < last && visibleCount;
             sectionIndex++) {
          const auto& sectionData = sections[sectionIndex];
          const float top =
              projectWorldZ(sectionData.top, distance, horizon, value->z,
                           focalLength);
          const float bottom =
              projectWorldZ(sectionData.bottom, distance, horizon, value->z,
                           focalLength);
          drawWallSection(screenX, segment, sectionData, top, bottom, visible,
                          visibleCount, distance);
          visibleCount = subtractInterval(visible, visibleCount, top, bottom);
          if (!visibleCount) break;
          visibleCount = drawSectionCaps(
              value, screenX, segment, first, sectionCount,
              sectionIndex - first, rayCos, visible, visibleCount, horizon,
              focalLength);
        }
      }

      visibleCount = renderPlane(value, screenX, segment, cell->floorMaterial,
                                 cell->floorHeight, rayCos, visible,
                                 visibleCount, horizon, focalLength);
      visibleCount = renderPlane(value, screenX, segment, cell->ceilingMaterial,
                                 cell->ceilingHeight, rayCos, visible,
                                 visibleCount, horizon, focalLength);
    }
  }

  // Sprites: one full-screen pass after every column is drawn, mirroring
  // SoftwareRenderer.js's renderSprites() -- filtered to sprites with a
  // resolved texture and a positive forward depth (using each sprite's own
  // anchor position for filtering/sorting, exactly as the JS reference
  // does even for oriented sprites), sorted farthest-first (painter's
  // algorithm; no per-sprite depth buffer writes), and tested against the
  // wall depth buffer built above.
  const float cameraSin = std::sin(value->angle);
  const float cameraCos = std::cos(value->angle);
  spriteDepthOrder.clear();
  for (std::size_t index = 0; index < sprites.size(); index++) {
    const auto& sprite = sprites[index];
    if (sprite.texture < 0) continue;
    float lateral;
    float depth;
    getSpriteCameraSpace(sprite.x, sprite.y, value, cameraSin, cameraCos,
                        lateral, depth);
    if (depth <= 0.0001f) continue;
    spriteDepthOrder.push_back({depth, lateral, static_cast<int>(index)});
  }
  std::sort(spriteDepthOrder.begin(), spriteDepthOrder.end(),
           [](const SpriteOrderEntry& a, const SpriteOrderEntry& b) {
             return a.depth > b.depth;
           });
  for (const auto& entry : spriteDepthOrder) {
    const auto& sprite = sprites[entry.index];
    if (sprite.billboard) {
      renderBillboardSprite(value, sprite, entry.lateral, entry.depth,
                            horizon, focalLength);
    } else {
      renderOrientedSprite(value, sprite, cameraSin, cameraCos, horizon,
                           focalLength);
    }
  }
}

int raycaster_width() { return framebufferWidth; }
int raycaster_height() { return framebufferHeight; }
int raycaster_world_map_size() { return static_cast<int>(worldMap.size()); }
int raycaster_cell_count() { return static_cast<int>(cells.size()); }
int raycaster_section_count() { return static_cast<int>(sections.size()); }
int raycaster_material_count() { return static_cast<int>(materials.size()); }
int raycaster_texture_count() { return static_cast<int>(textures.size()); }
int raycaster_sprite_count() { return static_cast<int>(sprites.size()); }
int raycaster_light_count() { return static_cast<int>(lights.size()); }
float raycaster_ambient() { return ambient; }
float raycaster_camera_fov() { return camera.fov; }
int raycaster_map_value(int index) {
  return index >= 0 && index < static_cast<int>(worldMap.size())
             ? worldMap[index]
             : -1;
}
int raycaster_cell_section_count(int cellId) {
  return cellId >= 0 && cellId < static_cast<int>(cells.size())
             ? cells[cellId].sectionCount
             : -1;
}

void raycaster_destroy() {
  std::free(framebuffer);
  framebuffer = nullptr;
  framebufferSize = 0;
  depthBuffer.clear();
  worldMap.clear();
  cells.clear();
  sections.clear();
  materials.clear();
  textures.clear();
  sprites.clear();
  lights.clear();
  segmentScratch.clear();
  spriteDepthOrder.clear();
  skyRowScratch.clear();
  skyTexture = -1;
  framebufferWidth = 0;
  framebufferHeight = 0;
  worldWidth = 0;
  worldHeight = 0;
}

}
