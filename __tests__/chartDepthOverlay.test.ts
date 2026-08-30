import {
  DEPTH_GEBCO_LAYER_NAME,
  DEPTH_TRACKS_LAYER_NAME,
  buildDepthWmsTileUrl,
  depthGebcoTileUrl,
  depthTracksTileUrl,
  shouldShowDepthOverlay,
} from '../src/lib/settings/chartDepthOverlay';
import { buildChartStyleSpec } from '../src/map/chartStyle';

describe('chartDepthOverlay', () => {
  it('builds allowlisted WMS tile templates with bbox token', () => {
    const gebco = depthGebcoTileUrl();
    const tracks = depthTracksTileUrl();
    expect(gebco).toContain('https://geoserver.openseamap.org/geoserver/wms?');
    expect(gebco).toContain(`LAYERS=${encodeURIComponent(DEPTH_GEBCO_LAYER_NAME)}`);
    expect(gebco).toContain('BBOX={bbox-epsg-3857}');
    expect(gebco).toContain('TRANSPARENT=true');
    expect(gebco).toContain('WIDTH=256');
    expect(tracks).toContain('https://depth.openseamap.org/geoserver/wms?');
    expect(tracks).toContain(`LAYERS=${encodeURIComponent(DEPTH_TRACKS_LAYER_NAME)}`);
    expect(tracks).toContain('BBOX={bbox-epsg-3857}');
  });

  it('rejects non-allowlisted hosts and unsafe layer names', () => {
    expect(() => buildDepthWmsTileUrl('https://evil.example', DEPTH_GEBCO_LAYER_NAME)).toThrow(
      /DEPTH_WMS_HOST_NOT_ALLOWED/,
    );
    expect(() =>
      buildDepthWmsTileUrl('https://geoserver.openseamap.org', 'gebco2021:gebco_2021&x=1'),
    ).toThrow(/DEPTH_WMS_LAYER_INVALID/);
  });

  it('gates overlay to online, loaded map, no download session, setting on', () => {
    expect(
      shouldShowDepthOverlay({
        settingEnabled: true,
        isOffline: false,
        downloadSessionActive: false,
        mapStyleLoaded: true,
      }),
    ).toBe(true);
    expect(
      shouldShowDepthOverlay({
        settingEnabled: false,
        isOffline: false,
        downloadSessionActive: false,
        mapStyleLoaded: true,
      }),
    ).toBe(false);
    expect(
      shouldShowDepthOverlay({
        settingEnabled: true,
        isOffline: true,
        downloadSessionActive: false,
        mapStyleLoaded: true,
      }),
    ).toBe(false);
    expect(
      shouldShowDepthOverlay({
        settingEnabled: true,
        isOffline: false,
        downloadSessionActive: true,
        mapStyleLoaded: true,
      }),
    ).toBe(false);
    expect(
      shouldShowDepthOverlay({
        settingEnabled: true,
        isOffline: false,
        downloadSessionActive: false,
        mapStyleLoaded: false,
      }),
    ).toBe(false);
  });

  it('keeps offline pack style free of depth WMS sources', () => {
    const spec = buildChartStyleSpec();
    const sourceIds = Object.keys(spec.sources ?? {});
    expect(sourceIds).toEqual(['osm-base', 'openseamap-seamarks']);
    const tiles = Object.values(spec.sources ?? {}).flatMap((source) => {
      if (source && typeof source === 'object' && 'tiles' in source && Array.isArray(source.tiles)) {
        return source.tiles as string[];
      }
      return [];
    });
    expect(tiles.some((url) => url.includes('geoserver') || url.includes('bbox-epsg'))).toBe(false);
  });
});
