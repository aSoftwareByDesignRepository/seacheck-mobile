import type { CoordFormat } from '../../settings/defaults';

/** Example position (Kiel) — stable preview in Settings and docs. */
export const COORD_FORMAT_EXAMPLE = { latitude: 54.323, longitude: 10.141 } as const;

export const COORD_FORMAT_ORDER: CoordFormat[] = ['ddm', 'dd', 'dms'];

export function nextCoordFormat(current: CoordFormat): CoordFormat {
  const idx = COORD_FORMAT_ORDER.indexOf(current);
  return COORD_FORMAT_ORDER[(idx + 1) % COORD_FORMAT_ORDER.length]!;
}

export type CoordFormatTitleKey =
  | 'coordinates.formats.ddm.title'
  | 'coordinates.formats.dd.title'
  | 'coordinates.formats.dms.title';

export function coordFormatTitleKey(format: CoordFormat): CoordFormatTitleKey {
  return `coordinates.formats.${format}.title` as CoordFormatTitleKey;
}

/** Default for boating — matches chart/radio convention. */
export const DEFAULT_COORD_FORMAT: CoordFormat = 'ddm';
