import { assessPassageCoverage } from '../src/lib/map/coverage';
import { REGION_PACKS } from '../src/map/regionPacks';

describe('passage coverage', () => {
  const kielPack = {
    id: 'kiel-bay',
    label: 'Kiel',
    bounds: REGION_PACKS[0].bounds,
    ready: true,
  };

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
});
