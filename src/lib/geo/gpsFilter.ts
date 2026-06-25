import type { LocationFix } from '../../services/locationService';

import { distanceNm, msToKnots } from './navigation';
import { isFixAccuracyOk, isValidCoordinate } from './fixQuality';

/** Maximum plausible speed for outlier rejection (kn) — allows fast power craft. */
export const MAX_IMPLIED_SPEED_KN = 45;

/** Minimum jump (m) before outlier logic applies — ignores GPS jitter at anchor. */
export const OUTLIER_MIN_JUMP_M = 25;

export type FixAcceptanceReason = 'ok' | 'outlier' | 'invalid' | 'poor_accuracy';

export type FixAcceptance = {
  accepted: boolean;
  reason: FixAcceptanceReason;
};

type FixLike = Pick<
  LocationFix,
  'latitude' | 'longitude' | 'timestamp' | 'speedKn' | 'accuracyM'
>;

/**
 * Rejects single-fix spikes that imply impossible speed — common multipath / GNSS jumps.
 * Raw fix is still stored; navigation, smoothing, and lastGoodFix skip rejected fixes.
 */
export function classifyFixAcceptance(previous: FixLike | null, next: FixLike): FixAcceptance {
  if (!isValidCoordinate(next.latitude, next.longitude)) {
    return { accepted: false, reason: 'invalid' };
  }

  if (!isFixAccuracyOk({ ...next, cogDeg: null, heading: null, speedMs: null, speedKn: null, altitudeM: null } as LocationFix)) {
    return { accepted: false, reason: 'poor_accuracy' };
  }

  if (!previous) {
    return { accepted: true, reason: 'ok' };
  }

  if (isFixOutlier(previous, next)) {
    return { accepted: false, reason: 'outlier' };
  }

  return { accepted: true, reason: 'ok' };
}

export function isFixOutlier(previous: FixLike, next: FixLike): boolean {
  const dtMs = next.timestamp - previous.timestamp;
  if (!Number.isFinite(dtMs) || dtMs <= 0) return false;

  const dtSec = Math.max(0.25, dtMs / 1000);
  const distNm = distanceNm(
    [previous.longitude, previous.latitude],
    [next.longitude, next.latitude],
  );
  const distM = distNm * 1852;

  if (distM < OUTLIER_MIN_JUMP_M) return false;

  const impliedKn = msToKnots(distM / dtSec);
  if (impliedKn == null) return false;
  const sogKn = Math.max(previous.speedKn ?? 0, next.speedKn ?? 0);
  const allowedKn = Math.min(MAX_IMPLIED_SPEED_KN, Math.max(8, sogKn * 2.5 + 6));

  if (impliedKn > allowedKn) return true;

  const accBudgetM = (previous.accuracyM ?? 20) + (next.accuracyM ?? 20);
  if (distM > accBudgetM * 3.5 && impliedKn > 12) return true;

  return false;
}

export type GpsSmoothState = {
  latitude: number;
  longitude: number;
  /** Sum of inverse-variance weights — capped so the filter tracks turns. */
  accumulatedWeight: number;
};

/** Accuracy-weighted blend — reduces jitter without hiding true movement. */
export function smoothGpsPosition(
  state: GpsSmoothState | null,
  fix: Pick<LocationFix, 'latitude' | 'longitude' | 'accuracyM'>,
): GpsSmoothState {
  const accuracyM = Math.max(3, fix.accuracyM ?? 25);
  const sampleWeight = 1 / (accuracyM * accuracyM);
  const maxHistoryWeight = sampleWeight * 4;

  if (!state) {
    return {
      latitude: fix.latitude,
      longitude: fix.longitude,
      accumulatedWeight: sampleWeight,
    };
  }

  const historyWeight = Math.min(state.accumulatedWeight, maxHistoryWeight);
  const totalWeight = historyWeight + sampleWeight;

  return {
    latitude: (state.latitude * historyWeight + fix.latitude * sampleWeight) / totalWeight,
    longitude: (state.longitude * historyWeight + fix.longitude * sampleWeight) / totalWeight,
    accumulatedWeight: totalWeight,
  };
}

/** Estimated horizontal uncertainty after smoothing (m) — never better than the latest fix. */
export function estimateSmoothedAccuracyM(
  smoothState: GpsSmoothState | null,
  latestAccuracyM: number | null,
): number | null {
  if (latestAccuracyM == null || !Number.isFinite(latestAccuracyM)) return latestAccuracyM;
  if (!smoothState || smoothState.accumulatedWeight <= 0) return latestAccuracyM;
  const fromWeight = Math.sqrt(1 / smoothState.accumulatedWeight);
  return Math.max(3, Math.min(latestAccuracyM, fromWeight * 0.9));
}

export function buildDisplayFix(base: LocationFix, smooth: GpsSmoothState, smoothEnabled: boolean): LocationFix {
  if (!smoothEnabled) return base;
  return {
    ...base,
    latitude: smooth.latitude,
    longitude: smooth.longitude,
    accuracyM: estimateSmoothedAccuracyM(smooth, base.accuracyM),
  };
}
