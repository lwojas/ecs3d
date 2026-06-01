/**
 * Decompose pure white areas into rectangles for Arcade Physics
 * @param {ImageData} imageData
 * @returns {Array<{x:number, y:number, width:number, height:number}>} rectangles
 */
export function decomposeWhiteToRectangles(imageData) {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const rectangles = [];

  function isWhite(x, y) {
    const idx = (y * width + x) * 4;
    return (
      data[idx] === 255 &&
      data[idx + 1] === 255 &&
      data[idx + 2] === 255 &&
      data[idx + 3] === 255
    );
  }

  function floodFill(x, y) {
    let minX = x,
      maxX = x,
      minY = y,
      maxY = y;
    const stack = [[x, y]];

    while (stack.length) {
      const [cx, cy] = stack.pop();
      const index = cy * width + cx;
      if (visited[index]) continue;
      visited[index] = 1;

      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      // check neighbors
      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (let [nx, ny] of neighbors) {
        if (
          nx >= 0 &&
          nx < width &&
          ny >= 0 &&
          ny < height &&
          !visited[ny * width + nx] &&
          isWhite(nx, ny)
        ) {
          stack.push([nx, ny]);
        }
      }
    }

    rectangles.push({
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx] && isWhite(x, y)) {
        floodFill(x, y);
      }
    }
  }

  return rectangles;
}
