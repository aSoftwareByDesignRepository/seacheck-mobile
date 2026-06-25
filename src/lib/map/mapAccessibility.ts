import { formatCoordinates } from '../../map/coords';
import type { CoordFormat } from '../../settings/defaults';
import { t } from '../../i18n';

type MapChartA11yInput = {
  centerLatitude: number;
  centerLongitude: number;
  coordFormat: CoordFormat;
  followMode: boolean;
  followActive: boolean;
  screenLocked: boolean;
  zoom?: number | null;
  boatLatitude?: number | null;
  boatLongitude?: number | null;
};

/** Spoken summary for VoiceOver / TalkBack — chart centre, boat position, follow state. */
export function buildMapChartAccessibilityLabel(input: MapChartA11yInput): string {
  const center = formatCoordinates(input.coordFormat, input.centerLatitude, input.centerLongitude);
  const parts = [t('map.chartA11yCenter', { coords: center })];

  if (
    input.boatLatitude != null &&
    input.boatLongitude != null &&
    (Math.abs(input.boatLatitude - input.centerLatitude) > 0.0001 ||
      Math.abs(input.boatLongitude - input.centerLongitude) > 0.0001)
  ) {
    const boat = formatCoordinates(input.coordFormat, input.boatLatitude, input.boatLongitude);
    parts.push(t('map.chartA11yBoat', { coords: boat }));
  }

  if (input.zoom != null && Number.isFinite(input.zoom)) {
    parts.push(t('map.chartA11yZoom', { zoom: input.zoom.toFixed(1) }));
  }

  if (input.screenLocked) {
    parts.push(t('map.chartA11yLocked'));
  } else if (input.followMode && input.followActive) {
    parts.push(t('map.chartA11yFollow'));
  } else if (input.followMode && !input.followActive) {
    parts.push(t('map.chartA11yPan'));
  }

  return parts.join('. ');
}
