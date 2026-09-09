import fs from 'fs';
import path from 'path';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { CHART_BASE_TILE_URL, CHART_BASE_TILE_URLS } from '../src/lib/settings/chartBaseStyle';
import {
  ANDROID_OFFLINE_PACK_STYLE_URI,
  buildChartStyleSpec,
  chartStyleDirectory,
  chartStyleFileUri,
  chartStyleFilesystemPath,
  CHART_STYLE_FILENAME,
  ensureChartStyleFile,
  ensureOfflinePackStyleReachable,
  offlinePackMapStyleUri,
  toMapLibreStyleUri,
} from '../src/map/chartStyle';

describe('buildChartStyleSpec', () => {
  it('includes OSM base and OpenSeaMap seamark raster sources', () => {
    const spec = buildChartStyleSpec();
    expect(spec.sources?.['osm-base']?.type).toBe('raster');
    expect(spec.sources?.['openseamap-seamarks']?.type).toBe('raster');
  });

  it('uses OSM base tile URLs', () => {
    const spec = buildChartStyleSpec();
    expect(spec.sources?.['osm-base']?.tiles).toEqual([...CHART_BASE_TILE_URLS]);
    expect(spec.sources?.['osm-base']?.tiles?.[0]).toBe(CHART_BASE_TILE_URL);
  });

  it('orders background, base, then seamarks', () => {
    const spec = buildChartStyleSpec();
    const ids = spec.layers?.map((l) => l.id);
    expect(ids).toEqual(['background', 'osm-base-layer', 'openseamap-seamarks-layer']);
  });

  it('matches the Android asset style used by OfflineManager.createPack', () => {
    const assetPath = path.join(__dirname, '../android/app/src/main/assets/map/chart-style.json');
    const asset = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
    expect(asset).toEqual(buildChartStyleSpec());
  });
});

describe('toMapLibreStyleUri', () => {
  it('prefixes absolute filesystem paths with file://', () => {
    expect(toMapLibreStyleUri('/data/map/chart-style.json')).toBe('file:///data/map/chart-style.json');
  });

  it('leaves file and https URIs unchanged', () => {
    expect(toMapLibreStyleUri('file:///tmp/style.json')).toBe('file:///tmp/style.json');
    expect(toMapLibreStyleUri('https://example.com/style.json')).toBe('https://example.com/style.json');
  });
});

describe('offlinePackMapStyleUri', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('uses loopback HTTP on Android so OfflineManager can fetch the style', () => {
    Platform.OS = 'android';
    expect(offlinePackMapStyleUri('file:///docs/map/chart-style.json')).toBe(ANDROID_OFFLINE_PACK_STYLE_URI);
    expect(ANDROID_OFFLINE_PACK_STYLE_URI).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
  });

  it('keeps the documents URI on iOS', () => {
    Platform.OS = 'ios';
    expect(offlinePackMapStyleUri('file:///docs/map/chart-style.json')).toBe(
      'file:///docs/map/chart-style.json',
    );
  });
});

describe('ensureOfflinePackStyleReachable', () => {
  const originalOS = Platform.OS;
  const originalFetch = global.fetch;

  afterEach(() => {
    Platform.OS = originalOS;
    global.fetch = originalFetch;
  });

  it('is a no-op for non-HTTP styles (iOS documents file://)', async () => {
    Platform.OS = 'ios';
    global.fetch = jest.fn();
    await expect(ensureOfflinePackStyleReachable('file:///docs/map/chart-style.json')).resolves.toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches the Android loopback style and rejects non-OK responses', async () => {
    Platform.OS = 'android';
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      text: async () => '',
    })) as unknown as typeof fetch;

    await expect(ensureOfflinePackStyleReachable('file:///docs/map/chart-style.json')).rejects.toThrow(
      /OFFLINE_STYLE_UNREACHABLE:503/,
    );
    expect(global.fetch).toHaveBeenCalledWith(
      ANDROID_OFFLINE_PACK_STYLE_URI,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects when the loopback body is not a chart style', async () => {
    Platform.OS = 'android';
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '<html>oops</html>',
    })) as unknown as typeof fetch;

    await expect(ensureOfflinePackStyleReachable('file:///docs/map/chart-style.json')).rejects.toThrow(
      'OFFLINE_STYLE_INVALID',
    );
  });

  it('accepts a valid chart-style JSON body', async () => {
    Platform.OS = 'android';
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(buildChartStyleSpec()),
    })) as unknown as typeof fetch;

    await expect(ensureOfflinePackStyleReachable('file:///docs/map/chart-style.json')).resolves.toBeUndefined();
  });
});

describe('chart style document paths + ensureChartStyleFile', () => {
  const getInfo = FileSystem.getInfoAsync as jest.Mock;
  const makeDir = FileSystem.makeDirectoryAsync as jest.Mock;
  const write = FileSystem.writeAsStringAsync as jest.Mock;
  const read = FileSystem.readAsStringAsync as jest.Mock;

  beforeEach(() => {
    getInfo.mockReset();
    makeDir.mockReset();
    write.mockReset();
    read.mockReset();
    getInfo.mockImplementation(async (uri: string) => {
      if (String(uri).endsWith('/map/') || String(uri).endsWith('/map')) {
        return { exists: true };
      }
      return { exists: true };
    });
    read.mockRejectedValue(new Error('ENOENT'));
    write.mockResolvedValue(undefined);
    makeDir.mockResolvedValue(undefined);
  });

  it('builds documentDirectory map paths under chart-style.json', () => {
    expect(CHART_STYLE_FILENAME).toBe('chart-style.json');
    expect(chartStyleDirectory()).toBe('file:///mock/map/');
    expect(chartStyleFilesystemPath()).toBe(`file:///mock/map/${CHART_STYLE_FILENAME}`);
    expect(chartStyleFileUri()).toBe(`file:///mock/map/${CHART_STYLE_FILENAME}`);
  });

  it('writes buildChartStyleSpec JSON when the documents file is missing/stale', async () => {
    const uri = await ensureChartStyleFile();
    expect(uri).toBe(`file:///mock/map/${CHART_STYLE_FILENAME}`);
    expect(write).toHaveBeenCalled();
    const written = write.mock.calls[0]?.[1] as string;
    expect(written).toContain('"osm-base"');
    expect(JSON.parse(written)).toEqual(buildChartStyleSpec());
  });
});
