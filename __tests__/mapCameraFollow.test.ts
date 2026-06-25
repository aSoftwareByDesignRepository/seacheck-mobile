import {
  CAMERA_FOLLOW_MIN_INTERVAL_MS,
  CAMERA_FOLLOW_MIN_MOVE_NM,
  cameraFollowDuration,
  evaluateCameraFollow,
  resolveMapInitialCenter,
  shouldPauseFollowOnRegionChange,
} from '../src/lib/map/mapCameraFollow';
import { KIEL_CENTER } from '../src/map/constants';

const FIX = {
  latitude: 54.5,
  longitude: 10.2,
  heading: null,
  cogDeg: 45,
  speedKn: 5,
  timestamp: Date.now(),
};

describe('mapCameraFollow', () => {
  it('resolves initial center from fix or falls back to Kiel', () => {
    expect(resolveMapInitialCenter(FIX)).toEqual([10.2, 54.5]);
    expect(resolveMapInitialCenter(null)).toEqual(KIEL_CENTER);
    expect(resolveMapInitialCenter({ latitude: 999, longitude: 10 })).toEqual(KIEL_CENTER);
  });

  it('only pauses follow on user-driven region changes', () => {
    expect(shouldPauseFollowOnRegionChange(true, true)).toBe(true);
    expect(shouldPauseFollowOnRegionChange(false, true)).toBe(false);
    expect(shouldPauseFollowOnRegionChange(true, false)).toBe(false);
  });

  it('centres immediately on first follow after map is ready', () => {
    const decision = evaluateCameraFollow({
      enabled: true,
      mapReady: true,
      fix: FIX,
      courseUp: false,
      followZoom: 13,
      nowMs: 1_000,
      lastFollowMs: 0,
      lastCenter: null,
      hasInitialCentered: false,
    });
    expect(decision).toEqual({
      shouldUpdate: true,
      isInitialCenter: true,
      center: [10.2, 54.5],
      bearing: undefined,
    });
    expect(cameraFollowDuration(true)).toBe(0);
    expect(cameraFollowDuration(false)).toBe(280);
  });

  it('waits for map ready and enabled', () => {
    expect(
      evaluateCameraFollow({
        enabled: false,
        mapReady: true,
        fix: FIX,
        courseUp: false,
        followZoom: 13,
        nowMs: 1_000,
        lastFollowMs: 0,
        lastCenter: null,
        hasInitialCentered: false,
      }),
    ).toBeNull();
    expect(
      evaluateCameraFollow({
        enabled: true,
        mapReady: false,
        fix: FIX,
        courseUp: false,
        followZoom: 13,
        nowMs: 1_000,
        lastFollowMs: 0,
        lastCenter: null,
        hasInitialCentered: false,
      }),
    ).toBeNull();
  });

  it('throttles small moves within interval', () => {
    const now = 10_000;
    expect(
      evaluateCameraFollow({
        enabled: true,
        mapReady: true,
        fix: FIX,
        courseUp: false,
        followZoom: 13,
        nowMs: now,
        lastFollowMs: now - 100,
        lastCenter: [10.2, 54.5],
        hasInitialCentered: true,
      }),
    ).toBeNull();
  });

  it('updates when moved beyond threshold even inside interval', () => {
    const decision = evaluateCameraFollow({
      enabled: true,
      mapReady: true,
      fix: { ...FIX, latitude: 54.52, longitude: 10.25 },
      courseUp: true,
      followZoom: 13,
      nowMs: 10_000,
      lastFollowMs: 10_000 - 100,
      lastCenter: [10.2, 54.5],
      hasInitialCentered: true,
    });
    expect(decision?.shouldUpdate).toBe(true);
    expect(decision?.bearing).toBe(45);
    expect(decision?.isInitialCenter).toBe(false);
  });

  it('updates after min interval when center unchanged', () => {
    const now = 20_000;
    const decision = evaluateCameraFollow({
      enabled: true,
      mapReady: true,
      fix: FIX,
      courseUp: false,
      followZoom: 13,
      nowMs: now,
      lastFollowMs: now - CAMERA_FOLLOW_MIN_INTERVAL_MS,
      lastCenter: [10.2, 54.5],
      hasInitialCentered: true,
    });
    expect(decision?.shouldUpdate).toBe(true);
    expect(decision?.isInitialCenter).toBe(false);
  });

  it('uses move threshold constant for small drift filter', () => {
    expect(CAMERA_FOLLOW_MIN_MOVE_NM).toBeGreaterThan(0);
  });
});
