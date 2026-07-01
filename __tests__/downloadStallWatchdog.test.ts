import type { OfflinePack, OfflinePackStatus } from '@maplibre/maplibre-react-native';

import { downloadCoordinator } from '../src/lib/offline/downloadCoordinator';
import { startDownloadStallWatchdog } from '../src/lib/offline/downloadStallWatchdog';

jest.mock('../src/lib/network/mapLibreNetworkGate', () => ({
  ensureMapLibreNetworkForDownload: jest.fn(),
}));

jest.mock('../src/lib/offline/warmupOfflineEngine', () => ({
  warmupOfflineEngine: jest.fn(async () => {}),
}));

const ensureNetwork = require('../src/lib/network/mapLibreNetworkGate').ensureMapLibreNetworkForDownload as jest.Mock;

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
});
