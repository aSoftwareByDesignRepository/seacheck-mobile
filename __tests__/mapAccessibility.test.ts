import { buildMapChartAccessibilityLabel } from '../src/lib/map/mapAccessibility';

describe('buildMapChartAccessibilityLabel', () => {
  it('describes chart centre and follow state', () => {
    const label = buildMapChartAccessibilityLabel({
      centerLatitude: 54.32,
      centerLongitude: 10.14,
      coordFormat: 'ddm',
      followMode: true,
      followActive: true,
      screenLocked: false,
      zoom: 13.2,
      boatLatitude: 54.32,
      boatLongitude: 10.14,
    });
    expect(label).toContain('54');
    expect(label.length).toBeGreaterThan(20);
  });

  it('notes when follow is paused after pan', () => {
    const label = buildMapChartAccessibilityLabel({
      centerLatitude: 54.5,
      centerLongitude: 10.5,
      coordFormat: 'dd',
      followMode: true,
      followActive: false,
      screenLocked: false,
      zoom: 11,
      boatLatitude: 54.32,
      boatLongitude: 10.14,
    });
    expect(label).toContain('54.5');
    expect(label).toContain('54.32');
  });
});

describe('buildMapChartAccessibilityLabel offline context', () => {
  const base = {
    centerLatitude: 54.32,
    centerLongitude: 10.14,
    coordFormat: 'decimal' as const,
    followMode: true,
    followActive: true,
    screenLocked: false,
  };

  it('announces offline without charts', () => {
    const label = buildMapChartAccessibilityLabel({
      ...base,
      isOffline: true,
      hasReadyPack: false,
    });
    expect(label).toContain('Offline with no downloaded charts');
  });

  it('announces offline uncovered viewport', () => {
    const label = buildMapChartAccessibilityLabel({
      ...base,
      isOffline: true,
      hasReadyPack: true,
      chartCovered: false,
    });
    expect(label).toContain('outside downloaded chart coverage');
  });

  it('announces offline covered viewport', () => {
    const label = buildMapChartAccessibilityLabel({
      ...base,
      isOffline: true,
      hasReadyPack: true,
      chartCovered: true,
    });
    expect(label).toContain('using downloaded charts');
  });
});
