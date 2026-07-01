import { t } from '../../i18n';
import { boundsCenter } from '../map/bounds';
import { getRegionPack } from '../../map/regionPacks';
import { formatRasterTileUrl, tileCoordsAt } from '../../map/tileMath';
import { CHART_BASE_TILE_URL } from '../settings/chartBaseStyle';

const PROBE_TIMEOUT_MS = 8_000;
const PROBE_ZOOM = 10;
const PROBE_CACHE_MS = 30_000;

let lastProbeOkAt = 0;

class ChartTileProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartTileProbeError';
  }
}

function probeTileUrl(): string {
  const kiel = getRegionPack('kiel-bay');
  const center = kiel ? boundsCenter(kiel.bounds) : { latitude: 54.32, longitude: 10.15 };
  const { x, y } = tileCoordsAt(center.longitude, center.latitude, PROBE_ZOOM);
  return formatRasterTileUrl(CHART_BASE_TILE_URL, PROBE_ZOOM, x, y);
}

function isProbeResponseOk(status: number): boolean {
  return status === 200 || status === 206 || status === 416;
}

async function fetchTileProbe(url: string, fetchFn: typeof fetch): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const head = await fetchFn(url, { method: 'HEAD', signal: controller.signal });
    if (head.status !== 405 && head.status !== 501) return head;
    return await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Range: 'bytes=0-511' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verify Carto base tiles respond before starting a native offline pack download.
 * Caches success briefly so preflight + startDownload do not double-hit the CDN.
 */
export async function assertChartTileReachability(fetchFn: typeof fetch = fetch): Promise<void> {
  if (Date.now() - lastProbeOkAt < PROBE_CACHE_MS) return;

  const url = probeTileUrl();
  try {
    const response = await fetchTileProbe(url, fetchFn);
    if (isProbeResponseOk(response.status)) {
      lastProbeOkAt = Date.now();
      return;
    }
    if (response.status >= 500) {
      throw new ChartTileProbeError(t('downloads.errorTileServerUnavailable'));
    }
    throw new ChartTileProbeError(t('downloads.errorTileServerUnreachable'));
  } catch (error) {
    if (error instanceof ChartTileProbeError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ChartTileProbeError(t('downloads.errorTileServerTimeout'));
    }
    throw new ChartTileProbeError(t('downloads.errorTileServerUnreachable'));
  }
}

/** Test-only — clears probe success cache. */
export function resetChartTileProbeCacheForTests(): void {
  lastProbeOkAt = 0;
}
