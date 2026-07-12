/** Extra wait after the last zoom sweep so in-flight tile writes can finish. */
export const TILE_SWEEP_FINAL_SETTLE_MS = 1_000;

/**
 * Keep the visible download map mounted briefly after persistence so MapLibre Native
 * can finish GL/tile work before the view is destroyed (Android crash guard).
 */
export const DOWNLOAD_MAP_LINGER_MS = 2_800;

/**
 * After the download coordinator lock clears, keep the download map as the sole GL
 * owner while its TextureView tears down — prevents NavigationMap + hidden engine
 * from mounting in the same frame (Android native crash on fast devices).
 */
export const DOWNLOAD_MAP_POST_TEARDOWN_MS = 1_600;

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test';
}

/** Production settle delay; zero under Jest so downloads finish without open timers. */
export function tileSweepFinalSettleMs(): number {
  return isTestRuntime() ? 0 : TILE_SWEEP_FINAL_SETTLE_MS;
}

/** Production linger delay; zero under Jest so store tests do not leak timers. */
export function downloadMapLingerMs(): number {
  return isTestRuntime() ? 0 : DOWNLOAD_MAP_LINGER_MS;
}

/** Post-coordinator linger; zero under Jest. */
export function downloadMapPostTeardownMs(): number {
  return isTestRuntime() ? 0 : DOWNLOAD_MAP_POST_TEARDOWN_MS;
}
