#pragma once

#include <cstddef>
#include <cstdint>

struct RaycasterCameraData {
  float x;
  float y;
  float z;
  float angle;
  float pitch;
  float fov;
};

struct RaycasterCellData {
  float floorHeight;
  float ceilingHeight;
  float fogDistance;
  std::int32_t firstSection;
  std::int32_t sectionCount;
  std::int32_t floorMaterial;
  std::int32_t ceilingMaterial;
  std::uint8_t blocking;
  std::uint8_t fogEnabled;
  std::uint8_t reserved[2];
  float fogR;
  float fogG;
  float fogB;
};

struct RaycasterSectionData {
  float bottom;
  float top;
  std::int32_t material;
};

struct RaycasterMaterialData {
  std::int32_t texture;
  float width;
  float height;
};

struct RaycasterSpriteData {
  float x;
  float y;
  float z;
  float width;
  float height;
  float scaleX;
  float scaleY;
  float angle;
  std::int32_t texture;
  std::uint8_t billboard;
  std::uint8_t reserved[3];
};

struct RaycasterLightData {
  float x;
  float y;
  float z;
  float radius;
  float intensity;
  float tintR;
  float tintG;
  float tintB;
};

static_assert(sizeof(RaycasterCameraData) == 24);
static_assert(sizeof(RaycasterCellData) == 44);
static_assert(sizeof(RaycasterSectionData) == 12);
static_assert(sizeof(RaycasterMaterialData) == 12);
static_assert(sizeof(RaycasterSpriteData) == 40);
static_assert(sizeof(RaycasterLightData) == 32);

extern "C" {
void raycaster_resize(int width, int height);
std::uintptr_t raycaster_framebuffer();
std::size_t raycaster_framebuffer_size();
void raycaster_clear(std::uint8_t red, std::uint8_t green, std::uint8_t blue,
                     std::uint8_t alpha);
void raycaster_reset_depth();
std::uintptr_t raycaster_depth_buffer();
std::size_t raycaster_depth_buffer_size();

void raycaster_update_world(int width, int height, const std::uint16_t* map,
                            std::size_t mapCount,
                            const RaycasterCellData* cells, int cellCount,
                            const RaycasterSectionData* sections,
                            int sectionCount,
                            const RaycasterMaterialData* materials,
                            int materialCount);
void raycaster_update_cell(int cellId, const RaycasterCellData* cell,
                           const RaycasterSectionData* sections,
                           int sectionCount);
void raycaster_update_texture(int id, int width, int height,
                              const std::uint8_t* pixels,
                              std::size_t pixelCount);
void raycaster_update_camera(const RaycasterCameraData* camera);
void raycaster_update_config(float cellSize, float maxDistance,
                             float cameraHeight);
void raycaster_update_frame(const RaycasterSpriteData* sprites,
                            int spriteCount,
                            const RaycasterLightData* lights, int lightCount,
                            float ambient);
// Sets the panoramic sky texture id (already uploaded via
// raycaster_update_texture, sharing the same texture-id space as materials
// and sprites), or -1 to fall back to the flat-colour sky/background fill.
void raycaster_set_sky(int textureId);
void raycaster_render_snapshot(const RaycasterCameraData* camera);
int raycaster_world_map_size();
int raycaster_cell_count();
int raycaster_section_count();
int raycaster_material_count();
int raycaster_texture_count();
int raycaster_sprite_count();
int raycaster_light_count();
float raycaster_ambient();
float raycaster_camera_fov();
void raycaster_destroy();
int raycaster_map_value(int index);
int raycaster_cell_section_count(int cellId);
}
