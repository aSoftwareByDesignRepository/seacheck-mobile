/**
 * Whether Carto / OpenSeaMap raster layers should be visible on the main chart.
 * Always visible — MapLibre serves live tiles, ambient cache, or offline packs.
 */
export function shouldShowChartRasterTiles(): boolean {
  return true;
}

/** Reactive selector — subscribe to region state changes. */
export function selectHasReadyOfflinePack(regions: Record<string, { state: string }>): boolean {
  return Object.values(regions).some((r) => r.state === 'ready');
}

export type ChartMapAlertKind = 'cacheOnly' | 'coverage' | 'download';

type ChartMapAlertInput = {
  offlineHydrated: boolean;
  /** Device has no network interface (isConnected === false). Not isInternetReachable — avoids Android false positives. */
  isOffline: boolean;
  hasReadyPack: boolean;
  chartCovered: boolean;
  downloadHintDismissed: boolean;
  /** Session dismiss — cleared when the device reconnects. */
  offlineChartAlertDismissed: boolean;
};

/** Which informational banner to show above the chart (never hides raster layers). */
export function resolveChartMapAlert(input: ChartMapAlertInput): ChartMapAlertKind | null {
  const {
    offlineHydrated,
    isOffline: deviceDisconnected,
    hasReadyPack,
    chartCovered,
    downloadHintDismissed,
    offlineChartAlertDismissed,
  } = input;
  if (!offlineHydrated) return null;
  if (deviceDisconnected) {
    if (offlineChartAlertDismissed) return null;
    if (hasReadyPack && !chartCovered) return 'coverage';
    if (!chartCovered) return 'cacheOnly';
    return null;
  }
  if (!hasReadyPack && !downloadHintDismissed) return 'download';
  return null;
}
