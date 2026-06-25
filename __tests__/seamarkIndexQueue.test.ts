import NetInfo from '@react-native-community/netinfo';

import {
  drainSeamarkIndexQueue,
  enqueueSeamarkIndex,
  ensureSeamarkIndexQueueListening,
  flushSeamarkIndexQueueForTests,
  pendingSeamarkIndexCount,
  registerSeamarkIndexExecutor,
  resetSeamarkIndexQueueForTests,
} from '../src/lib/seamarks/seamarkIndexQueue';

jest.mock('../src/lib/network/connectivity', () => ({
  fetchIsEffectivelyOnline: jest.fn(async () => true),
  isEffectivelyOnline: jest.fn(() => true),
}));

const KIEL_BOUNDS: [number, number, number, number] = [10.05, 54.22, 10.25, 54.42];

describe('seamarkIndexQueue', () => {
  beforeEach(() => {
    resetSeamarkIndexQueueForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deduplicates jobs for the same region', async () => {
    const run = jest.fn(async () => {});
    registerSeamarkIndexExecutor(run);

    enqueueSeamarkIndex('kiel-bay', KIEL_BOUNDS);
    enqueueSeamarkIndex('kiel-bay', KIEL_BOUNDS);
    await flushSeamarkIndexQueueForTests();

    expect(run).toHaveBeenCalledTimes(1);
    expect(pendingSeamarkIndexCount()).toBe(0);
  });

  it('retries with backoff after failure', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(new Error('overpass_503'))
      .mockResolvedValueOnce(undefined);
    registerSeamarkIndexExecutor(run);

    enqueueSeamarkIndex('kiel-bay', KIEL_BOUNDS);
    await flushSeamarkIndexQueueForTests();
    expect(run).toHaveBeenCalledTimes(1);
    expect(pendingSeamarkIndexCount()).toBe(1);

    jest.advanceTimersByTime(30_000);
    await flushSeamarkIndexQueueForTests();
    expect(run).toHaveBeenCalledTimes(2);
    expect(pendingSeamarkIndexCount()).toBe(0);
  });

  it('drains when connectivity listener fires', async () => {
    const listeners: Array<(state: { isConnected: boolean; isInternetReachable: boolean }) => void> = [];
    (NetInfo.addEventListener as jest.Mock).mockImplementation((listener: (typeof listeners)[number]) => {
      listeners.push(listener);
      return jest.fn();
    });

    const run = jest.fn(async () => {});
    registerSeamarkIndexExecutor(run);
    ensureSeamarkIndexQueueListening();

    enqueueSeamarkIndex('kiel-bay', KIEL_BOUNDS);
    await flushSeamarkIndexQueueForTests();
    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();
    enqueueSeamarkIndex('baltic-west', [9, 54, 13, 58]);
    listeners.at(-1)?.({ isConnected: true, isInternetReachable: true });
    await flushSeamarkIndexQueueForTests();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
