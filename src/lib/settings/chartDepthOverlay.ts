/**
 * Optional OpenSeaMap / GEBCO depth overlay — online-only, never baked into
 * OfflineManager pack styles (those stay OSM base + seamarks XYZ only).
 *
 * WMS is rendered via MapLibre’s `{bbox-epsg-3857}` raster tile template.
 * Hosts and layer names are fixed allowlists (no user-controlled URLs).
 */

/** Raster source id — GEBCO bathymetric colouring. */
export const DEPTH_GEBCO_SOURCE_ID = 'openseamap-depth-gebco';
/** Raster layer id — GEBCO (inserted under seamarks). */
export const DEPTH_GEBCO_LAYER_ID = 'openseamap-depth-gebco-layer';

/** Raster source id — crowdsourced track-point depths. */
export const DEPTH_TRACKS_SOURCE_ID = 'openseamap-depth-tracks';
/** Raster layer id — track depths. */
export const DEPTH_TRACKS_LAYER_ID = 'openseamap-depth-tracks-layer';

/** Style layer the depth rasters must sit under so seamarks stay readable. */
export const DEPTH_INSERT_BEFORE_LAYER_ID = 'openseamap-seamarks-layer';

const DEPTH_WMS_HOSTS = [
  'https://geoserver.openseamap.org',
  'https://depth.openseamap.org',
] as const;

/** GEBCO 2021 grid — deep-sea / coastal bathymetric shading (GeoServer WMS). */
export const DEPTH_GEBCO_LAYER_NAME = 'gebco2021:gebco_2021';

/** Crowdsourced sounding tracks (~100 m aggregation) — denser near popular routes. */
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

/**
 * Build a MapLibre WMS GetMap tile URL template (EPSG:3857 / Web Mercator).
 * `bbox={bbox-epsg-3857}` is substituted per tile by MapLibre Native.
 */
export function buildDepthWmsTileUrl(hostBase: string, layerName: string): string {
  if (!DEPTH_WMS_HOSTS.some((allowed) => hostBase === allowed || hostBase.startsWith(`${allowed}/`))) {
    throw new Error('DEPTH_WMS_HOST_NOT_ALLOWED');
  }
  if (!/^[a-zA-Z0-9_.:-]+$/.test(layerName)) {
    throw new Error('DEPTH_WMS_LAYER_INVALID');
  }
  const base = hostBase.replace(/\/$/, '');
  const params = [
    'SERVICE=WMS',
    'VERSION=1.1.1',
    'REQUEST=GetMap',
    `LAYERS=${encodeURIComponent(layerName)}`,
    'STYLES=',
    'FORMAT=image%2Fpng',
    'TRANSPARENT=true',
    'SRS=EPSG%3A3857',
    'WIDTH=256',
    'HEIGHT=256',
    'BBOX={bbox-epsg-3857}',
  ].join('&');
  return `${base}/geoserver/wms?${params}`;
}

export function depthGebcoTileUrl(): string {
  return buildDepthWmsTileUrl('https://geoserver.openseamap.org', DEPTH_GEBCO_LAYER_NAME);
}

export function depthTracksTileUrl(): string {
  return buildDepthWmsTileUrl('https://depth.openseamap.org', DEPTH_TRACKS_LAYER_NAME);
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
