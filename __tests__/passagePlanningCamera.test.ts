import {
  createPlanningCameraSession,
  markPlanningCameraFitted,
  markPlanningCameraUserAdjusted,
  shouldApplyPlanningFit,
  shouldMarkPlanningUserAdjusted,
  shouldRequestPlanningAutoFit,
  syncPlanningCameraSession,
} from '../src/lib/map/passagePlanningCamera';

describe('passagePlanningCamera', () => {
  it('resets fit state when the planning passage changes', () => {
    let session = createPlanningCameraSession();
    session = syncPlanningCameraSession(session, 'p1');
    expect(session).toMatchObject({
      passageId: 'p1',
      hasFitted: false,
      userAdjustedCamera: false,
      generation: 1,
    });

    session = markPlanningCameraFitted(session);
    session = markPlanningCameraUserAdjusted(session);
    session = syncPlanningCameraSession(session, 'p1');
    expect(session.hasFitted).toBe(true);
    expect(session.userAdjustedCamera).toBe(true);
    expect(session.generation).toBe(1);

    session = syncPlanningCameraSession(session, 'p2');
    expect(session).toMatchObject({
      passageId: 'p2',
      hasFitted: false,
      userAdjustedCamera: false,
      generation: 2,
    });

    session = syncPlanningCameraSession(session, null);
    expect(session.passageId).toBeNull();
    expect(session.generation).toBe(3);
  });

  it('requests auto-fit only once until fitted or user-adjusted', () => {
    expect(
      shouldRequestPlanningAutoFit({
        passageId: 'p1',
        mapStyleLoaded: true,
        hasFitted: false,
        userAdjustedCamera: false,
      }),
    ).toBe(true);

    expect(
      shouldRequestPlanningAutoFit({
        passageId: 'p1',
        mapStyleLoaded: false,
        hasFitted: false,
        userAdjustedCamera: false,
      }),
    ).toBe(false);

    expect(
      shouldRequestPlanningAutoFit({
        passageId: null,
        mapStyleLoaded: true,
        hasFitted: false,
        userAdjustedCamera: false,
      }),
    ).toBe(false);

    expect(
      shouldRequestPlanningAutoFit({
        passageId: 'p1',
        mapStyleLoaded: true,
        hasFitted: true,
        userAdjustedCamera: false,
      }),
    ).toBe(false);

    expect(
      shouldRequestPlanningAutoFit({
        passageId: 'p1',
        mapStyleLoaded: true,
        hasFitted: false,
        userAdjustedCamera: true,
      }),
    ).toBe(false);
  });

  it('never auto-applies fit after the user zooms/pans (revision bumps must not fit)', () => {
    expect(
      shouldApplyPlanningFit({
        requestPassageId: 'p1',
        currentPassageId: 'p1',
        requestGeneration: 2,
        currentGeneration: 2,
        userAdjustedCamera: true,
        waypointCount: 3,
        force: false,
      }),
    ).toBe(false);

    expect(
      shouldApplyPlanningFit({
        requestPassageId: 'p1',
        currentPassageId: 'p1',
        requestGeneration: 2,
        currentGeneration: 2,
        userAdjustedCamera: true,
        waypointCount: 3,
        force: true,
      }),
    ).toBe(true);
  });

  it('auto-fits only routes with at least two waypoints; force works from one', () => {
    expect(
      shouldApplyPlanningFit({
        requestPassageId: 'p1',
        currentPassageId: 'p1',
        requestGeneration: 1,
        currentGeneration: 1,
        userAdjustedCamera: false,
        waypointCount: 1,
        force: false,
      }),
    ).toBe(false);

    expect(
      shouldApplyPlanningFit({
        requestPassageId: 'p1',
        currentPassageId: 'p1',
        requestGeneration: 1,
        currentGeneration: 1,
        userAdjustedCamera: false,
        waypointCount: 2,
        force: false,
      }),
    ).toBe(true);

    expect(
      shouldApplyPlanningFit({
        requestPassageId: 'p1',
        currentPassageId: 'p1',
        requestGeneration: 1,
        currentGeneration: 1,
        userAdjustedCamera: false,
        waypointCount: 1,
        force: true,
      }),
    ).toBe(true);
  });

  it('cancels stale async fits when passage or generation changes', () => {
    expect(
      shouldApplyPlanningFit({
        requestPassageId: 'p1',
        currentPassageId: 'p2',
        requestGeneration: 1,
        currentGeneration: 1,
        userAdjustedCamera: false,
        waypointCount: 2,
        force: false,
      }),
    ).toBe(false);

    expect(
      shouldApplyPlanningFit({
        requestPassageId: 'p1',
        currentPassageId: 'p1',
        requestGeneration: 1,
        currentGeneration: 2,
        userAdjustedCamera: false,
        waypointCount: 2,
        force: false,
      }),
    ).toBe(false);

    expect(
      shouldApplyPlanningFit({
        requestPassageId: 'p1',
        currentPassageId: 'p1',
        requestGeneration: 2,
        currentGeneration: 2,
        userAdjustedCamera: false,
        waypointCount: 0,
        force: false,
      }),
    ).toBe(false);
  });

  it('marks user-adjusted only on interactive region changes while planning', () => {
    expect(shouldMarkPlanningUserAdjusted(true, true)).toBe(true);
    expect(shouldMarkPlanningUserAdjusted(true, false)).toBe(false);
    expect(shouldMarkPlanningUserAdjusted(false, true)).toBe(false);
  });
});
