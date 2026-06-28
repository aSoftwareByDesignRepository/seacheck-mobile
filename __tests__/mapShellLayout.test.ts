import { resolveMapShellLayout } from '../src/hooks/useMapShellLayout';

describe('resolveMapShellLayout', () => {
  it('uses stacked map-forward on compact portrait phones', () => {
    expect(resolveMapShellLayout('map-forward', 'compact', false)).toEqual({ split: false, row: false });
  });

  it('splits map-forward on medium and expanded form factors', () => {
    expect(resolveMapShellLayout('map-forward', 'medium', false)).toEqual({ split: true, row: true });
    expect(resolveMapShellLayout('map-forward', 'expanded', false)).toEqual({ split: true, row: true });
  });

  it('uses row split on compact landscape', () => {
    expect(resolveMapShellLayout('split', 'compact', true)).toEqual({ split: true, row: true });
  });

  it('uses stacked coordinates on compact portrait', () => {
    expect(resolveMapShellLayout('coordinates', 'compact', false)).toEqual({ split: true, row: false });
  });

  it('never splits instruments-only', () => {
    expect(resolveMapShellLayout('instruments-only', 'compact', false)).toEqual({ split: false, row: false });
    expect(resolveMapShellLayout('instruments-only', 'expanded', true)).toEqual({ split: false, row: false });
  });
});
