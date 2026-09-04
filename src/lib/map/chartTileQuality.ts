/** OpenSeaMap empty tile and OSM “blocked” placeholder are tiny solid-colour PNGs. */
export const MIN_VALID_CHART_TILE_BYTES = 500;

/** Reject transparent empty.png (~334 B) and OSM policy placeholder (~103 B). */
export function isPlaceholderChartTileBytes(bytes: Uint8Array): boolean {
  return bytes.byteLength < MIN_VALID_CHART_TILE_BYTES;
}
