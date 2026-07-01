import type { CoordFormat } from '../../settings/defaults';
import { formatLatitude, formatLongitude } from '../../map/coords';

export type CoordDisplayLayout = 'inline' | 'stacked';

export type CoordDisplay = {
  layout: CoordDisplayLayout;
  /** Single-line readout — lat and lon separated by · */
  inline: string;
  lat: string;
  lon: string;
};

/** Minimum viewport width (px) for inline coords without shrinking text. */
export function minWidthForInlineCoords(format: CoordFormat): number {
  if (format === 'dd') return 260;
  if (format === 'ddm') return 300;
  return 380;
}

/** Responsive coord presentation — inline when width allows, else compact stacked values only. */
export function resolveCoordDisplay(
  format: CoordFormat,
  lat: number,
  lon: number,
  viewportWidth: number,
): CoordDisplay {
  const latText = formatLatitude(format, lat);
  const lonText = formatLongitude(format, lon);
  const inline = `${latText} · ${lonText}`;
  const layout: CoordDisplayLayout =
    viewportWidth >= minWidthForInlineCoords(format) ? 'inline' : 'stacked';
  return { layout, inline, lat: latText, lon: lonText };
}
