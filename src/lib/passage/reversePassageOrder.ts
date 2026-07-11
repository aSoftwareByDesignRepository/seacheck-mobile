import { legOverrideKey, type LegOverride } from './computeLegs';

/** Remap active leg index when waypoint order is reversed. */
export function remapActiveLegIndexAfterReversal(waypointCount: number, activeLegIndex: number): number {
  if (waypointCount < 2) return 0;
  const lastLeg = waypointCount - 2;
  return Math.max(0, Math.min(lastLeg, lastLeg - activeLegIndex));
}

/** Swap from/to on each leg override to match reversed waypoint order. */
export function remapLegOverridesForReversal(
  orderedWaypointIds: string[],
  overrides: Record<string, LegOverride>,
): Array<{ fromWaypointId: string; toWaypointId: string; patch: LegOverride }> {
  const remapped: Array<{ fromWaypointId: string; toWaypointId: string; patch: LegOverride }> = [];
  for (let i = 0; i < orderedWaypointIds.length - 1; i++) {
    const from = orderedWaypointIds[i];
    const to = orderedWaypointIds[i + 1];
    const patch = overrides[legOverrideKey(from, to)];
    if (patch) {
      remapped.push({ fromWaypointId: to, toWaypointId: from, patch });
    }
  }
  return remapped;
}
