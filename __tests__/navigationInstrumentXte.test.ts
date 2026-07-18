import { buildInstrumentDetailMetrics } from '../src/features/map/instrumentDetailMetrics';
import type { NavigationInstrumentData } from '../src/hooks/useNavigationInstrumentData';

function baseData(overrides: Partial<NavigationInstrumentData> = {}): NavigationInstrumentData {
  return {
    stale: false,
    coordFix: null,
    coordsMuted: false,
    cogText: '045° T',
    sogText: '5.2',
    courseLabel: 'COG',
    accuracyText: '±8',
    goToTarget: null,
    anchorAlarm: null,
    nav: {
      bearingToTarget: null,
      bearingSuffix: 'T',
      distanceToTargetNm: null,
      etaLocal: null,
      etaDestLocal: null,
      plannedEtaDestLocal: null,
      xteNm: 0.2,
      xteSide: 'R',
      activeLegNumber: null,
      totalLegs: null,
      activeLegLabel: 'WP2 → WP3',
      remainingNm: null,
      sessionDistanceNm: 12.4,
    } as NavigationInstrumentData['nav'],
    showNavHero: false,
    showXte: false,
    showPassageMeta: false,
    showLeeway: false,
    leeway: null,
    distanceLabel: 'NM',
    remainingDistText: null,
    anchorDriftText: null,
    anchorLimitText: null,
    xteDisplay: { value: '0.20', unitLabel: 'NM R' },
    activePassageId: 'p1',
    ...overrides,
  };
}

describe('buildInstrumentDetailMetrics — XTE visibility', () => {
  it('omits XTE from detail grid when showXte is false', () => {
    const metrics = buildInstrumentDetailMetrics(
      baseData({
        showXte: false,
        nav: { ...baseData().nav, xteNm: 0.2, activeLegLabel: 'WP2 → WP3' },
      }),
    );
    expect(metrics.some((m) => m.key === 'xte')).toBe(false);
  });

  it('includes XTE and leg when showXte is true and nav hero is hidden', () => {
    const metrics = buildInstrumentDetailMetrics(
      baseData({
        showXte: true,
        nav: { ...baseData().nav, xteNm: 0.2, activeLegLabel: 'WP2 → WP3' },
      }),
    );
    expect(metrics.map((m) => m.key)).toEqual(expect.arrayContaining(['xte', 'leg']));
  });
});
