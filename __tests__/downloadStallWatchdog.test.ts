import type { OfflinePack, OfflinePackStatus } from '@maplibre/maplibre-react-native';
import { OfflineManager } from '@maplibre/maplibre-react-native';

import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
import { startDownloadStallWatchdog } from '../src/lib/offline/downloadStallWatchdog';
import { recreateOfflinePack } from '../src/lib/offline/nativePackRecovery';

jest.mock('../src/lib/network/mapLibreNetworkGate', () => ({
  ensureMapLibreNetworkForDownload: jest.fn(),
}));

jest.mock('../src/lib/offline/warmupOfflineEngine', () => ({
  warmupOfflineEngine: jest.fn(async () => {}),
}));

jest.mock('../src/lib/offline/offlineMapEngineHost', () => ({
  isOfflineMapEngineStyleLoaded: jest.fn(() => true),
  requestOfflineMapEngineStyleReload: jest.fn(),
  ensureOfflineMapEnginePrimedBeforeDownload: jest.fn(async () => {}),
}));

const ensureNetwork = require('../src/lib/network/mapLibreNetworkGate').ensureMapLibreNetworkForDownload as jest.Mock;
const { isOfflineMapEngineStyleLoaded, requestOfflineMapEngineStyleReload } =
  require('../src/lib/offline/offlineMapEngineHost') as {
    isOfflineMapEngineStyleLoaded: jest.Mock;
    requestOfflineMapEngineStyleReload: jest.Mock;
  };

function makePack(statuses: OfflinePackStatus[]): OfflinePack {
  let index = 0;
  return {
    id: 'pack-test',
    metadata: {},
    bounds: [0, 0, 1, 1],
    status: jest.fn(async () => statuses[Math.min(index++, statuses.length - 1)]!),
    resume: jest.fn(async () => {}),
    pause: jest.fn(async () => {}),
  } as unknown as OfflinePack;
}

describe('startDownloadStallWatchdog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    downloadCoordinator.end('kiel-bay');
    ensureNetwork.mockClear();
    isOfflineMapEngineStyleLoaded.mockReturnValue(true);
    requestOfflineMapEngineStyleReload.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    downloadCoordinator.end('kiel-bay');
  });

  it('keeps MapLibre network enabled on each poll', async () => {
    const pack = makePack([
      {
        id: 'pack-test',
        state: 'active',
        percentage: 5,
        completedResourceCount: 1,
        completedResourceSize: 1,
        completedTileCount: 1,
        completedTileSize: 1,
        requiredResourceCount: 20,
      },
    ]);
    const session = downloadCoordinator.tryBegin('kiel-bay')!;
    const stop = startDownloadStallWatchdog('kiel-bay', session, pack, jest.fn(), 'stalled');

    await Promise.resolve();
    expect(ensureNetwork).toHaveBeenCalled();

    stop();
    downloadCoordinator.end('kiel-bay');
  });

  it('allows longer timeout while requiredResourceCount is still 1', async () => {
    const stuck: OfflinePackStatus = {
      id: 'pack-test',
      state: 'active',
      percentage: 0,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 1,
    };
    const pack = makePack([stuck]);
    const session = downloadCoordinator.tryBegin('kiel-bay')!;
    const onStall = jest.fn();
    const stop = startDownloadStallWatchdog('kiel-bay', session, pack, onStall, 'stalled');

    await Promise.resolve();
    jest.advanceTimersByTime(125_000);
    await Promise.resolve();
    expect(onStall).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    expect(onStall).toHaveBeenCalledWith('stalled', expect.objectContaining({ requiredResourceCount: 1 }));

    stop();
    downloadCoordinator.end('kiel-bay');
  });

  it('waits longer when the map engine style is not loaded', async () => {
    isOfflineMapEngineStyleLoaded.mockReturnValue(false);
    const stuck: OfflinePackStatus = {
      id: 'pack-test',
      state: 'active',
      percentage: 0,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 1,
    };
    const pack = makePack([stuck]);
    const session = downloadCoordinator.tryBegin('kiel-bay')!;
    const onStall = jest.fn();
    const stop = startDownloadStallWatchdog(
      'kiel-bay',
      session,
      pack,
      onStall,
      'stalled',
      undefined,
      {
        chartStyleUri: 'file:///style-not-loaded.json',
        mapEngineStallMessage: 'engine stalled',
      },
    );

    await Promise.resolve();
    jest.advanceTimersByTime(185_000);
    await Promise.resolve();
    expect(onStall).not.toHaveBeenCalled();

    jest.advanceTimersByTime(60_000);
    await Promise.resolve();
    expect(onStall).toHaveBeenCalledWith(
      'engine stalled',
      expect.objectContaining({ requiredResourceCount: 1, mapEngineStyleLoaded: false }),
    );

    stop();
    downloadCoordinator.end('kiel-bay');
  });

  it('does not remount the hidden map when style is already loaded', async () => {
    const stuck: OfflinePackStatus = {
      id: 'pack-test',
      state: 'active',
      percentage: 0,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 1,
    };
    const pack = makePack([stuck]);
    const session = downloadCoordinator.tryBegin('kiel-bay')!;
    const stop = startDownloadStallWatchdog(
      'kiel-bay',
      session,
      pack,
      jest.fn(),
      'stalled',
      undefined,
      { chartStyleUri: 'file:///style-loaded.json' },
    );

    await jest.advanceTimersByTimeAsync(9_500);
    expect(requestOfflineMapEngineStyleReload).not.toHaveBeenCalled();

    stop();
    downloadCoordinator.end('kiel-bay');
  });

  it('remounts the hidden map only when style is not loaded', async () => {
    isOfflineMapEngineStyleLoaded.mockReturnValue(false);
    const stuck: OfflinePackStatus = {
      id: 'pack-test',
      state: 'active',
      percentage: 0,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 1,
    };
    const pack = makePack([stuck]);
    const session = downloadCoordinator.tryBegin('kiel-bay')!;
    const stop = startDownloadStallWatchdog(
      'kiel-bay',
      session,
      pack,
      jest.fn(),
      'stalled',
      undefined,
      { chartStyleUri: 'file:///style-not-loaded.json' },
    );

    await jest.advanceTimersByTimeAsync(9_500);
    expect(requestOfflineMapEngineStyleReload).toHaveBeenCalled();

    stop();
    downloadCoordinator.end('kiel-bay');
  });

  it('attempts recovery when native status stays null', async () => {
    const pack = {
      id: 'pack-null',
      metadata: {},
      bounds: [0, 0, 1, 1],
      status: jest.fn(async () => null),
      resume: jest.fn(async () => {}),
      pause: jest.fn(async () => {}),
    } as unknown as OfflinePack;
    const session = downloadCoordinator.tryBegin('kiel-bay')!;
    const onStall = jest.fn();
    const stop = startDownloadStallWatchdog('kiel-bay', session, pack, onStall, 'stalled');

    await jest.advanceTimersByTimeAsync(3_500);
    expect(pack.resume).toHaveBeenCalled();

    stop();
    downloadCoordinator.end('kiel-bay');
  });

  it('recreates the pack when enumeration never starts', async () => {
    const stuck: OfflinePackStatus = {
      id: 'pack-test',
      state: 'active',
      percentage: 0,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 1,
    };
    const pack = makePack([stuck]);
    const replacement = {
      ...pack,
      id: 'pack-recreated',
    } as OfflinePack;
    const onRecreatePack = jest.fn(async () => replacement);
    const session = downloadCoordinator.tryBegin('kiel-bay')!;
    const stop = startDownloadStallWatchdog(
      'kiel-bay',
      session,
      pack,
      jest.fn(),
      'stalled',
      undefined,
      {
        chartStyleUri: 'file:///style-loaded.json',
        onRecreatePack,
      },
    );

    await jest.advanceTimersByTimeAsync(22_000);
    expect(onRecreatePack).toHaveBeenCalledWith(pack);

    stop();
    downloadCoordinator.end('kiel-bay');
  });
});

describe('recreateOfflinePack', () => {
  beforeEach(() => {
    (OfflineManager.createPack as jest.Mock).mockReset();
    (OfflineManager.deletePack as jest.Mock).mockReset();
    (OfflineManager.addListener as jest.Mock).mockReset();
  });

  it('deletes the old pack and creates a fresh one', async () => {
    const oldPack = {
      id: 'pack-old',
      pause: jest.fn(async () => {}),
    } as unknown as OfflinePack;
    const newPack = {
      id: 'pack-new',
      resume: jest.fn(async () => {}),
      status: jest.fn(async () => ({
        id: 'pack-new',
        state: 'active',
        percentage: 0,
        completedResourceCount: 0,
        completedResourceSize: 0,
        completedTileCount: 0,
        completedTileSize: 0,
        requiredResourceCount: 48,
      })),
    } as unknown as OfflinePack;
    (OfflineManager.createPack as jest.Mock).mockResolvedValue(newPack);

    const result = await recreateOfflinePack(
      oldPack,
      {
        mapStyle: 'file:///style.json',
        bounds: [10, 54, 11, 55],
        minZoom: 10,
        maxZoom: 14,
        metadata: { regionId: 'kiel-bay' },
      },
      jest.fn(),
      jest.fn(),
    );

    expect(OfflineManager.deletePack).toHaveBeenCalledWith('pack-old');
    expect(OfflineManager.createPack).toHaveBeenCalled();
    expect(result?.id).toBe('pack-new');
  });
});
