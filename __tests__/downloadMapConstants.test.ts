import {
  DOWNLOAD_MAP_LINGER_MS,
  DOWNLOAD_MAP_POST_TEARDOWN_MS,
  OFFLINE_ENGINE_POST_SESSION_REMOUNT_MS,
  TILE_SWEEP_FINAL_SETTLE_MS,
  downloadMapLingerMs,
  downloadMapPostTeardownMs,
  offlineEnginePostSessionRemountMs,
  tileSweepFinalSettleMs,
} from '../src/lib/offline/downloadMapConstants';

describe('downloadMapConstants (Jest timer hygiene)', () => {
  it('zeros production delays under NODE_ENV=test so suites exit without forceExit', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(tileSweepFinalSettleMs()).toBe(0);
    expect(downloadMapLingerMs()).toBe(0);
    expect(downloadMapPostTeardownMs()).toBe(0);
    expect(offlineEnginePostSessionRemountMs()).toBe(0);
  });

  it('keeps positive production constants for non-test reference', () => {
    expect(TILE_SWEEP_FINAL_SETTLE_MS).toBeGreaterThan(0);
    expect(DOWNLOAD_MAP_LINGER_MS).toBeGreaterThan(0);
    expect(DOWNLOAD_MAP_POST_TEARDOWN_MS).toBeGreaterThan(0);
    expect(OFFLINE_ENGINE_POST_SESSION_REMOUNT_MS).toBeGreaterThan(0);
  });
});
