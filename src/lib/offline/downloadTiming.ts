/**
 * Production stall / recovery timings. Tests always use these (NODE_ENV=test).
 * Dev builds use compressed timings so Downloads failures surface in ~45s, not ~3min.
 */
export const PRODUCTION_DOWNLOAD_TIMING = {
  stallPollMs: 3_000,
  // Cold OfflineManager createPack can sit at required=1 for minutes while tiles enumerate.
  zeroProgressTimeoutMs: 240_000,
  initializingTimeoutMs: 300_000,
  styleEngineTimeoutMs: 300_000,
  partialStallTimeoutMs: 5 * 60_000,
  resumeAtMs: [5_000, 15_000, 40_000, 90_000, 150_000, 210_000] as const,
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
