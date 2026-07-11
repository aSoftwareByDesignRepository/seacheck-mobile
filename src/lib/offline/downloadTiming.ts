/**
 * Production stall / recovery timings. Tests always use these (NODE_ENV=test).
 * Dev builds use compressed timings so Downloads failures surface in ~45s, not ~3min.
 */
export const PRODUCTION_DOWNLOAD_TIMING = {
  stallPollMs: 3_000,
  zeroProgressTimeoutMs: 120_000,
  initializingTimeoutMs: 180_000,
  styleEngineTimeoutMs: 240_000,
  partialStallTimeoutMs: 3 * 60_000,
  resumeAtMs: [3_000, 8_000, 20_000, 45_000, 75_000, 105_000] as const,
  recreateKickstartPolls: 12,
  recreateKickstartIntervalMs: 400,
} as const;

/** ~4× faster feedback on device/emulator — production stays unchanged. */
export const DEV_DOWNLOAD_TIMING = {
  stallPollMs: 1_000,
  zeroProgressTimeoutMs: 45_000,
  initializingTimeoutMs: 45_000,
  styleEngineTimeoutMs: 60_000,
  partialStallTimeoutMs: 60_000,
  resumeAtMs: [1_000, 3_000, 6_000, 15_000, 25_000, 35_000] as const,
  recreateKickstartPolls: 8,
  recreateKickstartIntervalMs: 250,
} as const;

export type DownloadTiming = {
  stallPollMs: number;
  zeroProgressTimeoutMs: number;
  initializingTimeoutMs: number;
  styleEngineTimeoutMs: number;
  partialStallTimeoutMs: number;
  resumeAtMs: readonly number[];
  recreateKickstartPolls: number;
  recreateKickstartIntervalMs: number;
};

function useDevDownloadTiming(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true && process.env.NODE_ENV !== 'test';
}

/** Active download stall / recovery timings for the current runtime. */
export function getDownloadTiming(): DownloadTiming {
  return useDevDownloadTiming() ? DEV_DOWNLOAD_TIMING : PRODUCTION_DOWNLOAD_TIMING;
}
