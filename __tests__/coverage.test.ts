import { assessPassageCoverage, buildCoveragePacks, pointCoveredByReadyPacks, suggestPacksForPassage } from '../src/lib/map/coverage';
import { LEGACY_REGION_PACKS } from '../src/map/legacyRegionPacks';
import { REGION_PACKS } from '../src/map/regionPacks';

describe('passage coverage', () => {
  const kielPack = {
    id: 'kiel-bay',
    label: 'Kiel',
    bounds: REGION_PACKS[0].bounds,
    ready: true,
  };

  const kattegatNorth = REGION_PACKS.find((p) => p.id === 'kattegat-north')!;
  const kattegatSouth = REGION_PACKS.find((p) => p.id === 'kattegat-south')!;

  it('marks legs inside ready pack as covered', () => {
    const report = assessPassageCoverage(
      [
        { name: 'A', latitude: 54.32, longitude: 10.12 },
        { name: 'B', latitude: 54.34, longitude: 10.16 },
      ],
      [kielPack],
    );
    expect(report.fullyCovered).toBe(true);
    expect(report.legs[0].covered).toBe(true);
  });

  it('flags legs outside downloaded packs', () => {
    const report = assessPassageCoverage(
      [
        { name: 'A', latitude: 54.32, longitude: 10.12 },
        { name: 'B', latitude: 58.0, longitude: 12.0 },
      ],
      [kielPack],
    );
    expect(report.fullyCovered).toBe(false);
    expect(report.uncoveredLegCount).toBe(1);
  });

  it('reports no coverage when no packs ready', () => {
    const report = assessPassageCoverage(
      [
        { name: 'A', latitude: 54.32, longitude: 10.12 },
        { name: 'B', latitude: 54.34, longitude: 10.16 },
      ],
      [{ ...kielPack, ready: false }],
    );
    expect(report.fullyCovered).toBe(false);
    expect(report.readyPackCount).toBe(0);
  });

  it('includes ready legacy packs in coverage assessment', () => {
    const legacy = LEGACY_REGION_PACKS[0]!;
    const packs = buildCoveragePacks(
      { [legacy.id]: { state: 'ready' } },
      REGION_PACKS.map((p) => ({ id: p.id, nameKey: p.nameKey, bounds: p.bounds })),
      {},
      () => 'Legacy label',
      [{ id: legacy.id, nameKey: legacy.nameKey, bounds: legacy.bounds }],
    );
    expect(packs.some((p) => p.id === legacy.id && p.ready)).toBe(true);
  });

  it('suggests corridor packs for uncovered legs', () => {
    const waypoints = [
      { name: 'Kiel', latitude: 54.32, longitude: 10.12 },
      { name: 'North', latitude: 57.5, longitude: 11.0 },
    ];
    const candidates = REGION_PACKS.map((p) => ({ id: p.id, bounds: p.bounds, priority: p.priority }));
    const readyIds = new Set<string>();
    const result = suggestPacksForPassage(waypoints, candidates, [], readyIds);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.some((s) => s.packId === 'kiel-bay' || s.packId === 'kattegat-south')).toBe(true);
  });

  it('returns no suggestions when all legs are covered', () => {
    const waypoints = [
      { name: 'A', latitude: 54.32, longitude: 10.12 },
      { name: 'B', latitude: 54.34, longitude: 10.16 },
    ];
    const candidates = REGION_PACKS.map((p) => ({ id: p.id, bounds: p.bounds, priority: p.priority }));
    const readyPacks = [kielPack];
    const readyIds = new Set(['kiel-bay']);
    const result = suggestPacksForPassage(waypoints, candidates, readyPacks, readyIds);
    expect(result.suggestions).toEqual([]);
    expect(result.needsCustomArea).toBe(false);
  });

  it('prefers packs that cover more legs in greedy selection', () => {
    const waypoints = [
      { name: 'South', latitude: 55.0, longitude: 11.0 },
      { name: 'North', latitude: 57.0, longitude: 11.0 },
    ];
    const candidates = [
      { id: kattegatNorth.id, bounds: kattegatNorth.bounds, priority: kattegatNorth.priority },
      { id: kattegatSouth.id, bounds: kattegatSouth.bounds, priority: kattegatSouth.priority },
    ];
    const result = suggestPacksForPassage(waypoints, candidates, [], new Set());
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    const first = result.suggestions[0]!;
    expect(['kattegat-north', 'kattegat-south']).toContain(first.packId);
  });

  it('flags custom area when corridor packs cannot cover all legs', () => {
    const waypoints = [
      { name: 'Baltic', latitude: 54.5, longitude: 10.5 },
      { name: 'Finland', latitude: 60.0, longitude: 24.0 },
    ];
    const candidates = REGION_PACKS.map((p) => ({ id: p.id, bounds: p.bounds, priority: p.priority }));
    const result = suggestPacksForPassage(waypoints, candidates, [], new Set());
    expect(result.needsCustomArea).toBe(true);
    expect(result.uncoveredLegCountAfterSuggestions).toBeGreaterThan(0);
  });

  it('covers points inside antimeridian-crossing packs', () => {
    const pacificPack = {
      id: 'pacific-test',
      label: 'Pacific',
      bounds: [170, -20, -170, 20] as [number, number, number, number],
      ready: true,
    };
    expect(pointCoveredByReadyPacks(0, 175, [pacificPack])).toContain('Pacific');
    expect(pointCoveredByReadyPacks(0, -175, [pacificPack])).toContain('Pacific');
    expect(pointCoveredByReadyPacks(0, 0, [pacificPack])).toEqual([]);

    const report = assessPassageCoverage(
      [
        { name: 'West', latitude: 0, longitude: 175 },
        { name: 'East', latitude: 0, longitude: -175 },
      ],
      [pacificPack],
    );
    expect(report.fullyCovered).toBe(true);
  });
});
