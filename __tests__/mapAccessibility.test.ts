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
