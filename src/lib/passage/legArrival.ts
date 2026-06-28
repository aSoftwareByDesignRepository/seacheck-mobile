import { alongTrackFromStartNm, distanceNm, type LonLat } from '../geo/navigation';

/** Consider the leg waypoint passed when abeam/past it along the rhumb line (~55 m). */
export const LEG_PASS_ALONG_TRACK_MARGIN_NM = 0.03;

export type LegArrivalReason = 'proximity' | 'passed_along_track';

export type LegArrivalAssessment = {
  arrived: boolean;
  reason: LegArrivalReason | null;
  alongTrackNm: number;
  legLengthNm: number;
  distanceToWaypointNm: number;
};

export type PassageLegEndpoint = {
  from: { name: string; latitude: number; longitude: number };
  to: { name: string; latitude: number; longitude: number };
};

export type PassageLegAdvance = {
  completedLegIndex: number;
  nextLegIndex: number;
  waypointName: string;
  reason: LegArrivalReason;
};

function legEndpoints(leg: PassageLegEndpoint): { from: LonLat; to: LonLat } {
  return {
    from: [leg.from.longitude, leg.from.latitude],
    to: [leg.to.longitude, leg.to.latitude],
  };
}

/** Whether the current leg waypoint is reached (close) or passed (tacking / shortcut). */
export function assessLegWaypointArrival(
  position: LonLat,
  legFrom: LonLat,
  legTo: LonLat,
  arrivalRadiusNm: number,
): LegArrivalAssessment {
  const legLengthNm = distanceNm(legFrom, legTo);
  const alongTrackNm = alongTrackFromStartNm(position, legFrom, legTo);
  const distanceToWaypointNm = distanceNm(position, legTo);

  if (distanceToWaypointNm <= arrivalRadiusNm) {
    return { arrived: true, reason: 'proximity', alongTrackNm, legLengthNm, distanceToWaypointNm };
  }

  const passThreshold = legLengthNm - LEG_PASS_ALONG_TRACK_MARGIN_NM;
  if (legLengthNm > LEG_PASS_ALONG_TRACK_MARGIN_NM && alongTrackNm >= passThreshold) {
    return { arrived: true, reason: 'passed_along_track', alongTrackNm, legLengthNm, distanceToWaypointNm };
  }

  return { arrived: false, reason: null, alongTrackNm, legLengthNm, distanceToWaypointNm };
}

/** Clear arrival prompt/auto latch when clearly before the leg waypoint again. */
export function shouldResetLegArrivalLatch(assessment: LegArrivalAssessment, arrivalRadiusNm: number): boolean {
  if (assessment.arrived) return false;
  const resetDist = arrivalRadiusNm * 2;
  const resetAlongTrack = Math.max(0, assessment.legLengthNm - LEG_PASS_ALONG_TRACK_MARGIN_NM * 2);
  return assessment.distanceToWaypointNm > resetDist && assessment.alongTrackNm < resetAlongTrack;
}

/**
 * Walk forward from the active leg while each waypoint is reached/passed.
 * Handles tacking (along-track pass) and corner-cutting (abeam pass without entering the circle).
 */
export function computePassageLegAdvance(
  position: LonLat,
  legs: PassageLegEndpoint[],
  startLegIndex: number,
  arrivalRadiusNm: number,
): PassageLegAdvance | null {
  if (startLegIndex >= legs.length - 1) return null;

  let lastCompleted = -1;
  let lastReason: LegArrivalReason = 'proximity';

  for (let i = startLegIndex; i < legs.length; i++) {
    const { from, to } = legEndpoints(legs[i]);
    const assessment = assessLegWaypointArrival(position, from, to, arrivalRadiusNm);
    if (!assessment.arrived || assessment.reason == null) break;
    lastCompleted = i;
    lastReason = assessment.reason;
  }

  if (lastCompleted < startLegIndex) return null;

  return {
    completedLegIndex: lastCompleted,
    nextLegIndex: Math.min(lastCompleted + 1, legs.length - 1),
    waypointName: legs[lastCompleted].to.name,
    reason: lastReason,
  };
}
