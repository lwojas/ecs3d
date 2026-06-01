/**
 * Trace a simplified polygon (corners only) from the alpha channel of ImageData.
 * @param {ImageData} imageData - the image data to trace
 * @param {number} threshold - alpha threshold (0-255) to consider opaque
 * @param {boolean} debug - if true, log debug info
 * @returns {Array<{x:number,y:number}>} - array of corner points forming a polygon
 */
export function tracePolygonFromAlpha(
  imageData,
  threshold = 128,
  debug = false
) {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const polygon = [];

  function getAlpha(x, y) {
    return data[(y * width + x) * 4 + 3];
  }

  function isOpaque(x, y) {
    return getAlpha(x, y) >= threshold;
  }

  function isCorner(x, y) {
    const diag = [
      isOpaque(x - 1, y - 1), // NW
      isOpaque(x + 1, y - 1), // NE
      isOpaque(x - 1, y + 1), // SW
      isOpaque(x + 1, y + 1), // SE
    ];
    const nonWhiteCount = diag.filter((v) => !v).length;
    return nonWhiteCount === 1 || nonWhiteCount === 3;
  }

  function addPoint(x, y) {
    const last = polygon[polygon.length - 1];
    if (!last || last.x !== x || last.y !== y) {
      polygon.push({ x, y });
    }
  }

  function trace(x0, y0) {
    let x = x0;
    let y = y0;
    let dir = 0;
    let startX = x0;
    let startY = y0;
    let firstStep = true;

    do {
      visited[y * width + x] = 1;

      if (isCorner(x, y)) {
        addPoint(x, y);
      }

      let foundNext = false;
      for (let i = 0; i < 8; i++) {
        const dx = [1, 1, 0, -1, -1, -1, 0, 1][(dir + i) % 8];
        const dy = [0, 1, 1, 1, 0, -1, -1, -1][(dir + i) % 8];
        const nx = x + dx;
        const ny = y + dy;

        if (
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height &&
          isOpaque(nx, ny) &&
          (!visited[ny * width + nx] || // normal case
            (nx === startX && ny === startY)) // allow re-visiting start
        ) {
          x = nx;
          y = ny;
          dir = (dir + i + 6) % 8;
          foundNext = true;

          // if we've returned to start after moving
          if (!firstStep && x === startX && y === startY) {
            if (isCorner(x, y)) {
              addPoint(x, y);
            }
            if (debug) {
              console.log(
                `tracePolygonFromAlpha: traced polygon with ${polygon.length} points`
              );
            }
            return polygon;
          }

          break;
        }
      }

      if (!foundNext) break;
      firstStep = false;
    } while (true);

    if (debug) {
      console.log(
        `tracePolygonFromAlpha: traced polygon with ${polygon.length} points`
      );
    }
    return polygon;
  }

  // Find first opaque pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isOpaque(x, y)) {
        return trace(x, y);
      }
    }
  }

  if (debug) {
    console.log("tracePolygonFromAlpha: no opaque pixels found");
  }
  return polygon;
}
