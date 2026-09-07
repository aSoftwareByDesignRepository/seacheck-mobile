import {
  getDownloadMapGeneration,
  invalidateDownloadMapGeneration,
  markDownloadMapFrameRendered,
  markDownloadMapStyleLoaded,
  registerDownloadMapController,
  resetDownloadMapHostForTests,
  subscribeDownloadMapGeneration,
  waitForDownloadMapReady,
} from '../src/lib/offline/downloadMapHost';

describe('downloadMapHost readiness', () => {
  beforeEach(() => {
    resetDownloadMapHostForTests();
  });

  it('does not abort waitForDownloadMapReady on transient false notifies', async () => {
    const pending = waitForDownloadMapReady('file:///style.json', 500);
    // Simulate remount invalidate while waiter is listening — must stay registered.
    invalidateDownloadMapGeneration();
    invalidateDownloadMapGeneration();
    markDownloadMapStyleLoaded('file:///style.json');
    markDownloadMapFrameRendered();
    registerDownloadMapController({
      generation: getDownloadMapGeneration(),
      showTile: async () => {},
      fitBounds: async () => {},
      waitForFrame: async () => {},
    });
    await expect(pending).resolves.toBe(true);
  });

  it('stays registered across multiple remount notifies then succeeds', async () => {
    const pending = waitForDownloadMapReady('file:///style.json', 800);
    for (let i = 0; i < 5; i++) {
      invalidateDownloadMapGeneration();
      registerDownloadMapController(null);
    }
    markDownloadMapStyleLoaded('file:///style.json');
    markDownloadMapFrameRendered();
    registerDownloadMapController({
      generation: getDownloadMapGeneration(),
      showTile: async () => {},
      fitBounds: async () => {},
      waitForFrame: async () => {},
    });
    await expect(pending).resolves.toBe(true);
  });

  it('notifies generation subscribers when invalidate bumps the generation', () => {
    const seen: number[] = [];
    const unsub = subscribeDownloadMapGeneration(() => {
      seen.push(getDownloadMapGeneration());
    });
    const before = getDownloadMapGeneration();
    invalidateDownloadMapGeneration();
    unsub();
    expect(getDownloadMapGeneration()).toBe(before + 1);
    expect(seen).toEqual([before + 1]);
  });

  it('ignores style marks from a stale generation after reset', async () => {
    const staleGen = getDownloadMapGeneration();
    invalidateDownloadMapGeneration();
    markDownloadMapStyleLoaded('file:///style.json', staleGen);
    markDownloadMapFrameRendered(staleGen);
    registerDownloadMapController({
      generation: staleGen,
      showTile: async () => {},
      fitBounds: async () => {},
      waitForFrame: async () => {},
    });
    await expect(waitForDownloadMapReady('file:///style.json', 80)).resolves.toBe(false);
  });

  it('stays ready when controller is cleared then re-registered at the same generation', async () => {
    markDownloadMapStyleLoaded('file:///style.json');
    markDownloadMapFrameRendered();
    const live = {
      generation: getDownloadMapGeneration(),
      showTile: async () => {},
      fitBounds: async () => {},
      waitForFrame: async () => {},
    };
    registerDownloadMapController(live);
    // Effect cleanup used to invalidate here — that orphaned marks. Clearing the
    // controller alone must leave waiters able to succeed on re-register.
    registerDownloadMapController(null);
    const pending = waitForDownloadMapReady('file:///style.json', 400);
    registerDownloadMapController(live);
    await expect(pending).resolves.toBe(true);
  });
});
