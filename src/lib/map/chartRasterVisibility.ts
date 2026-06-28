/**
 * Whether Carto / OpenSeaMap raster layers should be visible on the main chart.
 * Online: always show (network tiles or offline cache).
 * Offline: only when a ready pack covers the current viewport centre.
 */
export function shouldShowChartRasterTiles(isOffline: boolean, hasReadyPack: boolean, chartCovered: boolean): boolean {
  if (!isOffline) return true;
  return hasReadyPack && chartCovered;
}

/** Reactive selector — subscribe to region state changes. */
export function selectHasReadyOfflinePack(regions: Record<string, { state: string }>): boolean {
  return Object.values(regions).some((r) => r.state === 'ready');
}
