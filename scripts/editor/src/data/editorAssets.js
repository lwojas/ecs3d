// Editor-only texture lookup, used purely to preview cell/sky textures
// visually (palette thumbnails, grid cells, the texture picker). This
// mirrors the image loads in scripts/boot.js's preload() by cache key --
// boot.js remains the source of truth for the running game and is never
// read or modified by the editor. Update this table when boot.js gains a
// new texture; a future asset browser can replace it entirely without
// touching anything else in the editor.
//
// Served read-only from the repo's assets/ folder via the dev server's
// /game-assets/* passthrough -- see server/devApiPlugin.js.
export const editorAssets = {
  wallTexture: "/game-assets/textures/wall.png",
  floorTexture: "/game-assets/textures/floor.png",
  ceilingTexture: "/game-assets/textures/ceiling.png",
  brickTexture: "/game-assets/textures/brick.png",
  skyTexture: "/game-assets/textures/sky.png",
  health: "/game-assets/items/health.png",
};
