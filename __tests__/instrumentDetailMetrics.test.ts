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
      xteNm: null,
      xteSide: null,
      activeLegNumber: null,
      totalLegs: null,
      activeLegLabel: null,
      remainingNm: null,
      sessionDistanceNm: 12.4,
    } as NavigationInstrumentData['nav'],
    showNavHero: false,
    showXte: false,
    showPassageMeta: false,
    showBarometer: false,
    barometer: { available: false, trend: { currentHpa: null, trend: 'steady', delta3h: null } } as NavigationInstrumentData['barometer'],
    showLeeway: false,
    leeway: null,
    distanceLabel: 'NM',
    remainingDistText: null,
    anchorDriftText: null,
    anchorLimitText: null,
    xteDisplay: { value: '0.1', unitLabel: 'NM' },
    activePassageId: null,
    ...overrides,
  };
}

describe('buildInstrumentDetailMetrics', () => {
  it('omits session distance run from instrument panels', () => {
    const metrics = buildInstrumentDetailMetrics(baseData());
    expect(metrics.some((m) => m.key === 'run')).toBe(false);
  });

  it('includes passage remaining and ETA when on active passage', () => {
    const metrics = buildInstrumentDetailMetrics(
      baseData({
        showPassageMeta: true,
        remainingDistText: '24.0',
        nav: {
          ...baseData().nav,
          remainingNm: 24,
          etaDestLocal: '14:30',
        },
      }),
    );
    expect(metrics.map((m) => m.key)).toEqual(expect.arrayContaining(['remaining', 'eta']));
  });

  it('omits passage remaining from detail grid when passage panel is shown', () => {
    const metrics = buildInstrumentDetailMetrics(
      baseData({
        showNavHero: true,
        showPassageMeta: true,
        remainingDistText: '24.0',
      }),
    );
    expect(metrics.some((m) => m.key === 'remaining')).toBe(false);
  });

  it('includes XTE and leg when navigating without nav hero', () => {
    const metrics = buildInstrumentDetailMetrics(
      baseData({
        showXte: true,
        nav: {
          ...baseData().nav,
          activeLegLabel: 'WP2 → WP3',
          xteNm: 0.2,
          xteSide: 'R',
        },
      }),
    );
    expect(metrics.map((m) => m.key)).toEqual(expect.arrayContaining(['xte', 'leg']));
  });

  it('includes anchor drift when anchor watch is active', () => {
    const metrics = buildInstrumentDetailMetrics(
      baseData({
        anchorDriftText: '0.02',
        anchorLimitText: '0.05',
      }),
    );
    expect(metrics.find((m) => m.key === 'drift')).toMatchObject({ value: '0.02' });
  });

  it('never shows GPS altitude in instrument panels', () => {
    const metrics = buildInstrumentDetailMetrics(baseData());
    expect(metrics.some((m) => m.key === 'alt')).toBe(false);
  });

  it('omits leeway from detail grid when showLeeway is false', () => {
    const metrics = buildInstrumentDetailMetrics(
      baseData({
        showLeeway: false,
        leeway: { angleDeg: 8, side: 'starboard' },
      }),
    );
    expect(metrics.some((m) => m.key === 'leeway')).toBe(false);
  });

  it('includes leeway when showLeeway is true', () => {
    const metrics = buildInstrumentDetailMetrics(
      baseData({
        showLeeway: true,
        leeway: { angleDeg: 8, side: 'starboard' },
      }),
    );
    expect(metrics.find((m) => m.key === 'leeway')).toMatchObject({ value: '8', unit: expect.stringContaining('°') });
  });
});
