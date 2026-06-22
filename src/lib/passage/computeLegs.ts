import type { WaypointRow } from '../db/database';
import { bearingTrue, distanceNm, etaUtcIso, legDurationHours, type LonLat } from '../geo/navigation';

export type LegOverride = {
  sogKn?: number;
  note?: string;
};

export type PassageLeg = {
  index: number;
  from: WaypointRow;
  to: WaypointRow;
  bearingDeg: number;
  distanceNm: number;
  cumulativeNm: number;
  sogKn: number;
  durationHours: number;
  etaUtc: string | null;
  note: string;
};

export function legOverrideKey(fromWaypointId: string, toWaypointId: string): string {
  return `${fromWaypointId}:${toWaypointId}`;
}

export function clampPlannedSogKn(value: number, fallback = 5): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(50, Math.max(0.1, value));
}

export function computePassageLegs(
  waypoints: WaypointRow[],
  defaultSogKn: number,
  departureMs: number | null,
  overrides: Record<string, LegOverride> = {},
): PassageLeg[] {
  const legs: PassageLeg[] = [];
  let cumulative = 0;
  let elapsedHours = 0;
  const baseSog = clampPlannedSogKn(defaultSogKn);

  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    const fromLl: LonLat = [from.longitude, from.latitude];
    const toLl: LonLat = [to.longitude, to.latitude];
    const dist = distanceNm(fromLl, toLl);
    cumulative += dist;
    const override = overrides[legOverrideKey(from.id, to.id)];
    const sogKn = clampPlannedSogKn(override?.sogKn ?? baseSog, baseSog);
    const duration = legDurationHours(dist, sogKn);
    elapsedHours += duration;
    legs.push({
      index: i,
      from,
      to,
      bearingDeg: bearingTrue(fromLl, toLl),
      distanceNm: dist,
      cumulativeNm: cumulative,
      sogKn,
      durationHours: duration,
      etaUtc: departureMs != null ? etaUtcIso(departureMs, elapsedHours) : null,
      note: override?.note?.trim() ?? '',
    });
  }
  return legs;
}
