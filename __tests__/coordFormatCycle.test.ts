import { COORD_FORMAT_ORDER, coordFormatTitleKey, nextCoordFormat } from '../src/lib/settings/coordFormats';

describe('coordFormats', () => {
  it('cycles through all formats in order', () => {
    expect(nextCoordFormat('ddm')).toBe('dd');
    expect(nextCoordFormat('dd')).toBe('dms');
    expect(nextCoordFormat('dms')).toBe('ddm');
  });

  it('lists maritime-friendly default first', () => {
    expect(COORD_FORMAT_ORDER[0]).toBe('ddm');
  });

  it('maps title keys for each format', () => {
    expect(coordFormatTitleKey('ddm')).toBe('coordinates.formats.ddm.title');
    expect(coordFormatTitleKey('dms')).toBe('coordinates.formats.dms.title');
  });
});
