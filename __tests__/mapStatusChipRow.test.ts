import { mapStatusChipRowStyle } from '../src/features/map/MapStatusChipRow';

describe('MapStatusChipRow', () => {
  it('wraps chips instead of clipping or requiring horizontal scroll', () => {
    const style = mapStatusChipRowStyle(8, 52, 4);
    expect(style.width).toBe('100%');
    expect(style.minWidth).toBe(0);
    expect(style.flexWrap).toBe('wrap');
    expect(style.flexDirection).toBe('row');
    expect(style.alignItems).toBe('center');
    expect(style.alignContent).toBe('flex-start');
  });
});
