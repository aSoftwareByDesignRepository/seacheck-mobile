/** Velocity made good toward a mark (kn). Returns null when SOG or geometry unavailable. */
export function velocityMadeGoodKn(sogKn: number, cogTrueDeg: number, bearingToMarkTrueDeg: number): number | null {
  if (!Number.isFinite(sogKn) || sogKn <= 0) return null;
  if (!Number.isFinite(cogTrueDeg) || !Number.isFinite(bearingToMarkTrueDeg)) return null;
  const delta = Math.abs(((cogTrueDeg - bearingToMarkTrueDeg + 540) % 360) - 180);
  const vmg = sogKn * Math.cos((delta * Math.PI) / 180);
  return Number.isFinite(vmg) ? vmg : null;
}

export type LaylineBearings = {
  portDeg: number;
  starboardDeg: number;
};

/**
 * Layline bearings (true °) from the mark, extending downwind for approach geometry.
 * windFromDeg: meteorological wind direction (where wind comes FROM).
 */
export function laylineBearingsFromMark(windFromDeg: number, tackingAngleDeg: number): LaylineBearings {
  const tack = Math.min(89, Math.max(20, tackingAngleDeg));
  const wind = ((windFromDeg % 360) + 360) % 360;
  return {
    portDeg: (wind + tack) % 360,
    starboardDeg: (wind - tack + 360) % 360,
  };
}

export function formatCountdownMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const RACE_COUNTDOWN_MARKS_MS = [300_000, 240_000, 180_000, 60_000, 30_000, 10_000, 5_000, 4_000, 1_000, 0] as const;
