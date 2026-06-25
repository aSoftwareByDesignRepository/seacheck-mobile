import * as Clipboard from 'expo-clipboard';

import { pickMaydayFix, copyMaydayToClipboard } from '../src/lib/emergency/copyMaydayClipboard';
import { useLocationStore } from '../src/services/locationService';

import type { LocationFix } from '../src/services/locationService';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

function freshFix(overrides: Partial<LocationFix> = {}): LocationFix {
  return {
    latitude: 54.1,
    longitude: 10.2,
    heading: null,
    cogDeg: null,
    speedMs: 0,
    speedKn: 0,
    accuracyM: 12,
    altitudeM: null,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('copyMaydayClipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationStore.setState({ fix: null, lastGoodFix: null });
  });

  it('prefers a fresh safety-grade fix', () => {
    useLocationStore.setState({ fix: freshFix(), lastGoodFix: freshFix({ latitude: 1 }) });
    expect(pickMaydayFix().quality).toBe('fresh');
    expect(pickMaydayFix().fix?.latitude).toBe(54.1);
  });

  it('falls back to stale current fix before lastGoodFix', () => {
    const stale = freshFix({ accuracyM: 200, timestamp: Date.now() - 120_000 });
    useLocationStore.setState({ fix: stale, lastGoodFix: freshFix({ latitude: 99 }) });
    const picked = pickMaydayFix();
    expect(picked.quality).toBe('stale');
    expect(picked.fix?.latitude).toBe(54.1);
  });

  it('uses lastGoodFix when no current fix', () => {
    useLocationStore.setState({ fix: null, lastGoodFix: freshFix() });
    expect(pickMaydayFix().quality).toBe('stale');
  });

  it('returns unavailable without coordinates', () => {
    expect(pickMaydayFix().quality).toBe('unavailable');
    expect(pickMaydayFix().fix).toBeNull();
  });

  it('copies to clipboard when a fix is available', async () => {
    useLocationStore.setState({ fix: freshFix(), lastGoodFix: null });
    const quality = await copyMaydayToClipboard(
      { name: 'Sea Breeze', callSign: '', mmsi: '', homePort: '' },
      'ddm',
    );
    expect(quality).toBe('fresh');
    expect(Clipboard.setStringAsync).toHaveBeenCalled();
  });
});
