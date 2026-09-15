// Editor-only texture lookup, used purely to preview cell/sky textures
// visually (palette thumbnails, grid cells, the texture picker). This
// mirrors the image loads in scripts/boot.js's preload() by cache key --
// boot.js remains the source of truth for the running game and is never
// read or modified by the editor. Update this table when boot.js gains a
// new texture; a future asset browser can replace it entirely without
// touching anything else in the editor.
//
// Served read-only from the repo's assets/ folder through Vite's publicDir.
export const editorAssets = {
  wallTexture: "/textures/wall.png",
  floorTexture: "/textures/floor.png",
  ceilingTexture: "/textures/ceiling.png",
  brickTexture: "/textures/brick.png",
  skyTexture: "/textures/sky.png",
  doorTexture: "/textures/door.png",
  wallXTexture: "/textures/wall_cross_yellow.png",
  health: "/items/health.png",
  keyRed: "/items/key_red.png",
  wallTexture3: "/textures/m-002.png",
};
