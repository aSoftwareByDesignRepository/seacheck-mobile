import type { FollowZoomLevel } from '../../settings/defaults';
import { KIEL_CENTER } from '../../map/constants';
import { isValidCoordinate } from '../geo/fixQuality';
import { distanceNm, type LonLat } from '../geo/navigation';
import type { LocationFix } from '../../services/locationService';
import { displayCog } from '../../services/locationService';

export const CAMERA_FOLLOW_MIN_INTERVAL_MS = 400;
/** ~15 m — follow when moved enough to matter on chart. */
export const CAMERA_FOLLOW_MIN_MOVE_NM = 0.008;

export type MapFollowFix = Pick<LocationFix, 'latitude' | 'longitude' | 'heading' | 'cogDeg' | 'speedKn' | 'timestamp'>;

export function resolveMapInitialCenter(
  fix: Pick<LocationFix, 'latitude' | 'longitude'> | null | undefined,
  fallback: LonLat = KIEL_CENTER,
): LonLat {
  if (fix && isValidCoordinate(fix.latitude, fix.longitude)) {
    return [fix.longitude, fix.latitude];
  }
  return fallback;
}

/** Follow mode should only pause when the user moves the chart — not on programmatic camera updates. */
export function shouldPauseFollowOnRegionChange(userInteraction: boolean, followMode: boolean): boolean {
  return followMode && userInteraction;
}

export function fixToLonLat(fix: MapFollowFix): LonLat {
  return [fix.longitude, fix.latitude];
}

export type CameraFollowDecision = {
  shouldUpdate: boolean;
  isInitialCenter: boolean;
  center: LonLat;
  bearing: number | undefined;
};

type EvaluateCameraFollowInput = {
  enabled: boolean;
  mapReady: boolean;
  fix: MapFollowFix | null;
  courseUp: boolean;
  followZoom: FollowZoomLevel;
  nowMs: number;
  lastFollowMs: number;
  lastCenter: LonLat | null;
  hasInitialCentered: boolean;
};

/** Pure follow/throttle logic — unit-tested, drives useMapCameraFollow. */
export function evaluateCameraFollow(input: EvaluateCameraFollowInput): CameraFollowDecision | null {
  if (!input.enabled || !input.mapReady || !input.fix) return null;

  const center = fixToLonLat(input.fix);
  let shouldUpdate = input.nowMs - input.lastFollowMs >= CAMERA_FOLLOW_MIN_INTERVAL_MS;

  if (input.lastCenter) {
    const moved = distanceNm(input.lastCenter, center);
    if (moved >= CAMERA_FOLLOW_MIN_MOVE_NM) shouldUpdate = true;
  } else {
    shouldUpdate = true;
  }

  if (!shouldUpdate) return null;

  const cog = displayCog(input.fix as LocationFix);
  const bearing = input.courseUp && cog != null ? cog : undefined;
  const isInitialCenter = !input.hasInitialCentered;

  return { shouldUpdate: true, isInitialCenter, center, bearing };
}

export function cameraFollowDuration(isInitialCenter: boolean): number {
  return isInitialCenter ? 0 : 280;
}
