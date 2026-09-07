import * as Location from 'expo-location';

import {
  applyBackgroundLocationFix,
  resetGpsWriteQueueForTests,
  useLocationStore,
} from '../src/services/locationService';

function fakeLoc(lat: number, lon: number, timestamp: number): Location.LocationObject {
  return {
    coords: {
      latitude: lat,
      longitude: lon,
      altitude: null,
      accuracy: 5,
      altitudeAccuracy: null,
      heading: 90,
      speed: 2,
    },
    timestamp,
    mocked: false,
  };
}

describe('GPS write serialization', () => {
  beforeEach(() => {
    resetGpsWriteQueueForTests();
    useLocationStore.setState({
      fix: null,
      displayFix: null,
      lastGoodFix: null,
      fixAcceptance: null,
      watching: false,
    });
  });

  it('applies overlapping background fixes in enqueue order (monotonic timestamps)', () => {
    const t0 = Date.now();
    // Nested enqueue during first mutation must not interleave state mid-write.
    const first = fakeLoc(54.32, 10.14, t0);
    const second = fakeLoc(54.321, 10.141, t0 + 2_000);

    let nestedRan = false;
    const originalSetState = useLocationStore.setState.bind(useLocationStore);
    useLocationStore.setState = ((partial: unknown) => {
      if (!nestedRan) {
        nestedRan = true;
        applyBackgroundLocationFix(second);
      }
      return originalSetState(partial as never);
    }) as typeof useLocationStore.setState;

    applyBackgroundLocationFix(first);
    useLocationStore.setState = originalSetState;

    const fix = useLocationStore.getState().fix;
    expect(fix).not.toBeNull();
    expect(fix!.timestamp).toBe(t0 + 2_000);
    expect(fix!.latitude).toBeCloseTo(54.321, 5);
  });
});
