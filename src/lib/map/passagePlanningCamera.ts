/**
 * Passage planning camera policy.
 *
 * Auto-fit once when entering a planned passage (so an existing route is visible),
 * then preserve the navigator's pan/zoom. Waypoint add/edit/remove must NEVER
 * re-fit — that was snapping zoom back to "route overview" on every long-press.
 *
 * Explicit fit (`force`) is the escape hatch when the route grows off-screen.
 */

export type PlanningCameraSession = {
  passageId: string | null;
  /** True after a successful auto or forced fit for this passage session. */
  hasFitted: boolean;
  /** True when the user panned/zoomed the chart while planning this passage. */
  userAdjustedCamera: boolean;
  /** Bumped on passage change / stop — cancels in-flight async fits. */
  generation: number;
};

export function createPlanningCameraSession(): PlanningCameraSession {
  return {
    passageId: null,
    hasFitted: false,
    userAdjustedCamera: false,
    generation: 0,
  };
}

/** Reset session when planning passage changes or planning stops. */
export function syncPlanningCameraSession(
  session: PlanningCameraSession,
  passageId: string | null,
): PlanningCameraSession {
  if (session.passageId === passageId) return session;
  return {
    passageId,
    hasFitted: false,
    userAdjustedCamera: false,
    generation: session.generation + 1,
  };
}

/**
 * Kick off the one-shot auto-fit for the current planning passage.
 * Deliberately ignores revision / waypoint mutations.
 */
export function shouldRequestPlanningAutoFit(input: {
  passageId: string | null;
  mapStyleLoaded: boolean;
  hasFitted: boolean;
  userAdjustedCamera: boolean;
}): boolean {
  return (
    input.passageId != null &&
    input.mapStyleLoaded &&
    !input.hasFitted &&
    !input.userAdjustedCamera
  );
}

/**
 * Apply a loaded bounds fit only if the session is still current.
 * `force` is for the explicit "Fit route" control (works from 1 waypoint).
 * Auto-fit needs ≥2 waypoints so a single long-press while building a new
 * passage never races a zoom snap after the user already framed the chart.
 */
export function shouldApplyPlanningFit(input: {
  requestPassageId: string;
  currentPassageId: string | null;
  requestGeneration: number;
  currentGeneration: number;
  userAdjustedCamera: boolean;
  waypointCount: number;
  force: boolean;
}): boolean {
  if (input.currentPassageId !== input.requestPassageId) return false;
  if (input.requestGeneration !== input.currentGeneration) return false;
  const minWaypoints = input.force ? 1 : 2;
  if (input.waypointCount < minWaypoints) return false;
  if (!input.force && input.userAdjustedCamera) return false;
  return true;
}

/** Follow-style: only user gestures suppress auto-fit / mark adjustment. */
export function shouldMarkPlanningUserAdjusted(
  planningActive: boolean,
  userInteraction: boolean,
): boolean {
  return planningActive && userInteraction;
}

export function markPlanningCameraFitted(session: PlanningCameraSession): PlanningCameraSession {
  return { ...session, hasFitted: true, userAdjustedCamera: false };
}

export function markPlanningCameraUserAdjusted(session: PlanningCameraSession): PlanningCameraSession {
  return { ...session, userAdjustedCamera: true };
}
