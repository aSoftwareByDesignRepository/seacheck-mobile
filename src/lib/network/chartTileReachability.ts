import { t } from '../../i18n';
import { boundsCenter, type LonLatPoint } from '../map/bounds';
import { getRegionPack } from '../../map/regionPacks';
import { formatRasterTileUrl, tileCoordsAt } from '../../map/tileMath';
import { CHART_BASE_TILE_URL, SEAMARK_TILE_URL } from '../settings/chartBaseStyle';

const PROBE_TIMEOUT_MS = 8_000;
const PROBE_ZOOM = 10;
const PROBE_CACHE_MS = 30_000;
const PROBE_ATTEMPTS = 3;
const RETRY_DELAY_MS = [0, 700, 1_800] as const;

const DEFAULT_PROBE_CENTER = { latitude: 54.32, longitude: 10.15 };

let lastProbeOkAt = 0;
let lastProbeOkKey: string | null = null;

export type ChartTileProbeDiagnostics = {
  probeCenter: string;
  baseUrl: string;
  seamarkUrl: string;
  attempts: number;
  lastHttpStatus: number | null;
  lastError: string | null;
};

let lastProbeDiagnostics: ChartTileProbeDiagnostics | null = null;

class ChartTileProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartTileProbeError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveProbeCenter(probeCenter?: LonLatPoint): LonLatPoint {
  if (probeCenter) return probeCenter;
  const kiel = getRegionPack('kiel-bay');
  return kiel ? boundsCenter(kiel.bounds) : DEFAULT_PROBE_CENTER;
}

/** ~1 km precision — enough to dedupe preflight + startDownload without skipping distant probes. */
function probeCacheKey(center: LonLatPoint): string {
  return `${center.latitude.toFixed(2)},${center.longitude.toFixed(2)}`;
}

function probeTileUrls(probeCenter?: LonLatPoint): { baseUrl: string; seamarkUrl: string } {
  const center = resolveProbeCenter(probeCenter);
  const { x, y } = tileCoordsAt(center.longitude, center.latitude, PROBE_ZOOM);
  return {
    baseUrl: formatRasterTileUrl(CHART_BASE_TILE_URL, PROBE_ZOOM, x, y),
    seamarkUrl: formatRasterTileUrl(SEAMARK_TILE_URL, PROBE_ZOOM, x, y),
  };
}

function isProbeResponseOk(status: number): boolean {
  return status === 200 || status === 206 || status === 416;
}

function isRetryableHttpStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

function errorForHttpStatus(status: number, seamark: boolean): ChartTileProbeError {
  if (status >= 500 || status === 429) {
    return new ChartTileProbeError(t('downloads.errorTileServerUnavailable'));
  }
  if (seamark) {
    return new ChartTileProbeError(t('downloads.errorSeamarkTileServerUnreachable'));
  }
  return new ChartTileProbeError(t('downloads.errorTileServerUnreachable'));
}

function errorForNetworkFailure(error: unknown): ChartTileProbeError {
  if (error instanceof Error && error.name === 'AbortError') {
    return new ChartTileProbeError(t('downloads.errorTileServerTimeout'));
  }
  return new ChartTileProbeError(t('downloads.errorTileServerUnreachable'));
}

/**
 * GET with a tiny Range request — matches MapLibre tile fetches and avoids Android
 * React Native HEAD quirks (OkHttp often fails HEAD while GET works).
 */
async function fetchTileProbe(url: string, fetchFn: typeof fetch): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Range: 'bytes=0-511' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeSingleUrl(
  url: string,
  fetchFn: typeof fetch,
  seamark: boolean,
  diagnostics: ChartTileProbeDiagnostics,
): Promise<void> {
  let lastError: ChartTileProbeError | null = null;

  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt++) {
    diagnostics.attempts += 1;
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS[attempt] ?? 1_800);
    }
    try {
      const response = await fetchTileProbe(url, fetchFn);
      diagnostics.lastHttpStatus = response.status;
      if (isProbeResponseOk(response.status)) {
        diagnostics.lastError = null;
        return;
      }
      lastError = errorForHttpStatus(response.status, seamark);
      if (!isRetryableHttpStatus(response.status)) {
        diagnostics.lastError = lastError.message;
        throw lastError;
      }
      diagnostics.lastError = lastError.message;
    } catch (error) {
      if (error instanceof ChartTileProbeError) {
        lastError = error;
        diagnostics.lastError = error.message;
        if (!isRetryableHttpStatus(diagnostics.lastHttpStatus ?? 0)) {
          throw error;
        }
        continue;
      }
      lastError = errorForNetworkFailure(error);
      diagnostics.lastError = lastError.message;
      diagnostics.lastHttpStatus = null;
    }
  }

  throw lastError ?? errorForNetworkFailure(new Error('probe exhausted'));
}

/**
 * Verify Carto base + OpenSeaMap seamark tiles respond before starting a native offline pack download.
 * Caches success briefly so preflight + startDownload do not double-hit the CDN.
 */
export async function assertChartTileReachability(
  fetchFn: typeof fetch = fetch,
  probeCenter?: LonLatPoint,
): Promise<void> {
  const center = resolveProbeCenter(probeCenter);
  const cacheKey = probeCacheKey(center);
  if (Date.now() - lastProbeOkAt < PROBE_CACHE_MS && lastProbeOkKey === cacheKey) return;

  const { baseUrl, seamarkUrl } = probeTileUrls(center);
  const diagnostics: ChartTileProbeDiagnostics = {
    probeCenter: `${center.longitude},${center.latitude}`,
    baseUrl,
    seamarkUrl,
    attempts: 0,
    lastHttpStatus: null,
    lastError: null,
  };
  lastProbeDiagnostics = diagnostics;

  try {
    await probeSingleUrl(baseUrl, fetchFn, false, diagnostics);
    await probeSingleUrl(seamarkUrl, fetchFn, true, diagnostics);
    lastProbeOkAt = Date.now();
    lastProbeOkKey = cacheKey;
    diagnostics.lastError = null;
  } catch (error) {
    if (error instanceof ChartTileProbeError) throw error;
    throw errorForNetworkFailure(error);
  }
}

export function peekChartTileProbeDiagnostics(): ChartTileProbeDiagnostics | null {
  return lastProbeDiagnostics;
}

/** Test-only — clears probe success cache and diagnostics. */
export function resetChartTileProbeCacheForTests(): void {
  lastProbeOkAt = 0;
  lastProbeOkKey = null;
  lastProbeDiagnostics = null;
}
