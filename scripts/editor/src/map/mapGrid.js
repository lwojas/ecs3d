// Pure helpers over the map's grid representation -- an array of digit
// strings, one per row (unchanged from the game's own format; see
// scripts/data/maps/testMap.json). Kept separate from any component so
// GridEditor/MapProperties stay simple wiring around these.

export function setTile(mapRows, x, y, tileId) {
  const row = mapRows[y];
  if (row === undefined || x < 0 || x >= row.length) return mapRows;
  const nextRow = row.slice(0, x) + tileId + row.slice(x + 1);
  const next = mapRows.slice();
  next[y] = nextRow;
  return next;
}

// Grows/shrinks every row to `width`, padding new columns with `fill`,
// and adds/removes rows to reach `height`.
export function resizeGrid(mapRows, width, height, fill = "0") {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = (mapRows[y] ?? "").slice(0, width);
    while (row.length < width) row += fill;
    rows.push(row);
  }
  return rows;
}
