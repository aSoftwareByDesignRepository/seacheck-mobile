import { LOW_SOG_KN } from './navigation';

/** Signed leeway: positive = COG to starboard of heading (starboard drift). */
export function leewayDeg(headingDeg: number, cogDeg: number): number {
  return ((cogDeg - headingDeg + 540) % 360) - 180;
}

export type LeewaySide = 'port' | 'starboard' | 'none';

export function leewaySide(angleDeg: number): LeewaySide {
  if (Math.abs(angleDeg) < 0.5) return 'none';
  return angleDeg > 0 ? 'starboard' : 'port';
}

export function computeLeeway(
  sogKn: number | null,
  headingDeg: number | null,
  cogDeg: number | null,
): { angleDeg: number; side: LeewaySide } | null {
  if (sogKn == null || sogKn < LOW_SOG_KN) return null;
  if (headingDeg == null || cogDeg == null) return null;
  if (Number.isNaN(headingDeg) || Number.isNaN(cogDeg)) return null;
  const angle = leewayDeg(headingDeg, cogDeg);
  return { angleDeg: angle, side: leewaySide(angle) };
}
