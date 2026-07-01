import { minWidthForInlineCoords, resolveCoordDisplay } from '../src/lib/map/coordDisplayLayout';

describe('coordDisplayLayout', () => {
  const lat = 54.99508;
  const lon = 12.16678;

  it('uses inline layout on wide viewports', () => {
    const d = resolveCoordDisplay('ddm', lat, lon, 400);
    expect(d.layout).toBe('inline');
    expect(d.inline).toContain('·');
    expect(d.inline).toContain('N');
    expect(d.inline).toContain('E');
  });

  it('stacks on narrow viewports for DMS', () => {
    const d = resolveCoordDisplay('dms', lat, lon, 320);
    expect(d.layout).toBe('stacked');
    expect(d.lat).toMatch(/N$/);
    expect(d.lon).toMatch(/E$/);
  });

  it('allows inline DDM on typical phone width', () => {
    expect(minWidthForInlineCoords('ddm')).toBeLessThanOrEqual(360);
    expect(resolveCoordDisplay('ddm', lat, lon, 360).layout).toBe('inline');
  });
});
