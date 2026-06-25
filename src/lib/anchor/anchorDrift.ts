import { isValidCoordinate } from '../geo/fixQuality';
import { distanceNm } from '../geo/navigation';

/** Rhumb distance from anchor drop point to current GPS position (nautical miles). */
export function computeAnchorDriftNm(
  anchor: { latitude: number; longitude: number } | null | undefined,
  fix: { latitude: number; longitude: number } | null | undefined,
): number | null {
  if (!anchor || !fix) return null;
  if (!isValidCoordinate(anchor.latitude, anchor.longitude)) return null;
  if (!isValidCoordinate(fix.latitude, fix.longitude)) return null;
  return distanceNm([anchor.longitude, anchor.latitude], [fix.longitude, fix.latitude]);
}
