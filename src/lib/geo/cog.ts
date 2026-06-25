import { bearingTrue, distanceNm, LOW_SOG_KN, type LonLat } from './navigation';

/** Minimum rhumb segment (NM) before trusting GPS-derived COG. */
const MIN_COG_SEGMENT_NM = 0.001;

/** Ignore segments older than this when computing COG. */
const MAX_COG_AGE_MS = 15_000;

export type CogFixInput = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speedKn: number | null;
  cogDeg: number | null;
  timestamp: number;
};

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Rhumb bearing from previous fix to current — filters GPS jitter. */
export function computeGpsCogDeg(
  previous: { latitude: number; longitude: number; timestamp: number },
  current: { latitude: number; longitude: number; timestamp: number },
): number | null {
  const dt = current.timestamp - previous.timestamp;
  if (dt <= 0 || dt > MAX_COG_AGE_MS) return null;
  const from: LonLat = [previous.longitude, previous.latitude];
  const to: LonLat = [current.longitude, current.latitude];
  const dist = distanceNm(from, to);
  if (dist < MIN_COG_SEGMENT_NM) return null;
  return bearingTrue(from, to);
}

/**
 * Display COG per plan §6.4:
 * - SOG ≥ threshold → GPS-derived COG, heading fallback while COG stabilizes
 * - SOG < threshold → magnetic/GPS heading (LOW SOG badge shown separately)
 */
export function resolveDisplayCog(fix: CogFixInput | null): number | null {
  if (!fix) return null;
  const kn = fix.speedKn ?? 0;
  if (kn >= LOW_SOG_KN) {
    if (fix.cogDeg != null && !Number.isNaN(fix.cogDeg)) return normalizeDeg(fix.cogDeg);
    if (fix.heading != null && !Number.isNaN(fix.heading)) return normalizeDeg(fix.heading);
    return null;
  }
  if (fix.heading != null && !Number.isNaN(fix.heading)) return normalizeDeg(fix.heading);
  return null;
}

/** Boat icon + course vector bearing — same rules as instruments. */
export function resolveBoatHeadingDeg(fix: CogFixInput | null): number | null {
  return resolveDisplayCog(fix);
}
