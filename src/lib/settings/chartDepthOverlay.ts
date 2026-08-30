/**
 * Optional OpenSeaMap / GEBCO depth overlay — online-only, never baked into
 * OfflineManager pack styles (those stay OSM base + seamarks XYZ only).
 *
 * WMS is rendered via MapLibre’s `{bbox-epsg-3857}` raster tile template.
 * Endpoints and layer names are fixed allowlists (no user-controlled URLs).
 *
 * Privacy: when enabled and online, MapLibre fetches tiles from these hosts
 * (approximate viewport location). Documented in Play Data Safety / privacy.
 */

/** Raster source id — GEBCO bathymetric colouring. */
export const DEPTH_GEBCO_SOURCE_ID = 'openseamap-depth-gebco';
/** Raster layer id — GEBCO (under track depths + seamarks). */
export const DEPTH_GEBCO_LAYER_ID = 'openseamap-depth-gebco-layer';

/** Raster source id — crowdsourced track-point depths. */
export const DEPTH_TRACKS_SOURCE_ID = 'openseamap-depth-tracks';
/** Raster layer id — track depths (under seamarks). */
export const DEPTH_TRACKS_LAYER_ID = 'openseamap-depth-tracks-layer';

/** Style layer the depth rasters must sit under so seamarks stay readable. */
export const DEPTH_INSERT_BEFORE_LAYER_ID = 'openseamap-seamarks-layer';

/**
 * Full WMS GetMap endpoints (path included). Prefer GWC for GEBCO — OpenSeaMap’s
 * own online chart uses the same cached path.
 */
export const DEPTH_GEBCO_WMS_ENDPOINT =
  'https://geoserver.openseamap.org/geoserver/gwc/service/wms' as const;
export const DEPTH_TRACKS_WMS_ENDPOINT =
  'https://depth.openseamap.org/geoserver/wms' as const;

const DEPTH_WMS_ENDPOINTS: readonly string[] = [
  DEPTH_GEBCO_WMS_ENDPOINT,
  DEPTH_TRACKS_WMS_ENDPOINT,
  // Direct (non-GWC) GEBCO — allowlisted only as a documented fallback constant for tests/probes.
  'https://geoserver.openseamap.org/geoserver/wms',
];

/** GEBCO 2021 grid — deep-sea / coastal bathymetric shading. */
export const DEPTH_GEBCO_LAYER_NAME = 'gebco2021:gebco_2021';

/** Crowdsourced sounding tracks (~100 m aggregation) on depth.openseamap.org GeoServer. */
export const DEPTH_TRACKS_LAYER_NAME = 'openseamap:tracks_100m';

export const DEPTH_GEBCO_ATTRIBUTION =
  '© GEBCO 2021 · © OpenStreetMap / OpenSeaMap — unofficial depths, not for navigation';
export const DEPTH_TRACKS_ATTRIBUTION =
  '© OpenSeaMap depth tracks — crowdsourced, not for navigation';

/** Soft shade so base chart and seamarks remain primary. */
export const DEPTH_GEBCO_OPACITY = 0.45;
/** Track depths are sparse points/lines — keep them readable. */
export const DEPTH_TRACKS_OPACITY = 0.85;

/** GEBCO is coarse; skip high zooms to reduce WMS load. */
export const DEPTH_GEBCO_MAX_ZOOM = 12;
/** Track depths remain useful a bit closer in. */
export const DEPTH_TRACKS_MAX_ZOOM = 16;
export const DEPTH_MIN_ZOOM = 4;

const LAYER_NAME_RE = /^[a-zA-Z0-9_.:-]+$/;

function assertAllowedEndpoint(endpoint: string): string {
  const normalized = endpoint.replace(/\/$/, '');
  if (!DEPTH_WMS_ENDPOINTS.includes(normalized)) {
    throw new Error('DEPTH_WMS_HOST_NOT_ALLOWED');
  }
  return normalized;
}

function assertLayerName(layerName: string): string {
  if (!LAYER_NAME_RE.test(layerName)) {
    throw new Error('DEPTH_WMS_LAYER_INVALID');
  }
  return layerName;
}

/**
 * Build a MapLibre WMS GetMap tile URL template (EPSG:3857 / Web Mercator).
 * `bbox={bbox-epsg-3857}` is substituted per tile by MapLibre Native.
 */
export function buildDepthWmsTileUrl(endpoint: string, layerName: string): string {
  const base = assertAllowedEndpoint(endpoint);
  const layer = assertLayerName(layerName);
  const params = [
    'SERVICE=WMS',
    'VERSION=1.1.1',
    'REQUEST=GetMap',
    `LAYERS=${encodeURIComponent(layer)}`,
    'STYLES=',
    'FORMAT=image%2Fpng',
    'TRANSPARENT=true',
    'SRS=EPSG%3A3857',
    'WIDTH=256',
    'HEIGHT=256',
    'BBOX={bbox-epsg-3857}',
  ].join('&');
  return `${base}?${params}`;
}

export function depthGebcoTileUrl(): string {
  return buildDepthWmsTileUrl(DEPTH_GEBCO_WMS_ENDPOINT, DEPTH_GEBCO_LAYER_NAME);
}

export function depthTracksTileUrl(): string {
  return buildDepthWmsTileUrl(DEPTH_TRACKS_WMS_ENDPOINT, DEPTH_TRACKS_LAYER_NAME);
}

export type DepthOverlayGate = {
  /** User preference — default false. */
  settingEnabled: boolean;
  /** Device effectively offline (no usable network). */
  isOffline: boolean;
  /** Exclusive chart download owns the GL surface. */
  downloadSessionActive: boolean;
  /** Navigation map style finished loading. */
  mapStyleLoaded: boolean;
};

/**
 * Depth is opt-in, online-only, and never mounts during exclusive downloads
 * (protects OfflineManager / download-map exclusivity).
 */
export function shouldShowDepthOverlay(gate: DepthOverlayGate): boolean {
  return (
    gate.settingEnabled === true &&
    gate.isOffline !== true &&
    gate.downloadSessionActive !== true &&
    gate.mapStyleLoaded === true
  );
}
