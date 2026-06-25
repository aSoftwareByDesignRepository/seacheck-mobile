import { computeAnchorDriftNm } from '../src/lib/anchor/anchorDrift';

describe('computeAnchorDriftNm', () => {
  it('returns rhumb distance from anchor to current position', () => {
    const drift = computeAnchorDriftNm(
      { latitude: 54, longitude: 10 },
      { latitude: 54.01, longitude: 10 },
    );
    expect(drift).not.toBeNull();
    expect(drift!).toBeGreaterThan(0.5);
  });

  it('returns null without anchor or fix', () => {
    expect(computeAnchorDriftNm(null, { latitude: 54, longitude: 10 })).toBeNull();
    expect(computeAnchorDriftNm({ latitude: 54, longitude: 10 }, null)).toBeNull();
  });

  it('returns null for invalid coordinates', () => {
    expect(computeAnchorDriftNm({ latitude: 999, longitude: 10 }, { latitude: 54, longitude: 10 })).toBeNull();
  });
});
