const ASSET_PROJECT = "raycaster";

const ASSET_SERVER = "http://lynn2:3002";

async function getAllAssets() {
  const response = await fetch(
    `${ASSET_SERVER}/projects/${ASSET_PROJECT}/assets`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load asset manifest: ${response.status}`);
  }
  const { assets } = await response.json();
  return assets;
}

export async function loadAssets(game) {
  // game.load.onFileError.add(function (file) {
  //   console.error("ASSET LOAD FAILED:", file.key, file.url);
  // });

  // game.load.onFileComplete.add(
  //   function (progress, key, success, totalLoaded, totalFiles) {
  //     console.log("ASSET LOADED:", key, success);
  //   },
  // );

  game.load.onLoadComplete.add(function () {
    console.log("ALL ASSETS LOADED FROM SERVER");
  });

  game.load.crossOrigin = true;

  const assets = await getAllAssets();

  assets.forEach((asset) => {
    const location = `${ASSET_SERVER}${asset.location}`;

    switch (asset.type) {
      case "image":
        game.load.image(asset.assetKey, location, true);
        break;

      case "spritesheet":
        game.load.spritesheet(
          asset.assetKey,
          location,
          asset.frameWidth,
          asset.frameHeight,
          true,
        );
        break;

      case "audio":
        game.load.audio(asset.assetKey, location, true);
        break;

      default:
        console.warn(`Unsupported asset type: ${asset.type}`);
    }
  });
  game.load.start();
}

export async function loadEditorAssets() {
  const assets = await getAllAssets();
  const editorAssets = {};
  assets.forEach((asset) => {
    const location = `${ASSET_SERVER}${asset.location}`;
    editorAssets[asset.assetKey] = location;
  });
  return editorAssets;
}
