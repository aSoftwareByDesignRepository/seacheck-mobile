import { formatCoordinates } from '../../map/coords';
import { fixAgeSeconds } from '../geo/fixAge';
import { t } from '../../i18n';
import type { CoordFormat } from '../../settings/defaults';
import { isFixStale, type LocationFix } from '../../services/locationService';

export type VesselInfo = {
  name: string;
  callSign: string;
  mmsi: string;
  homePort: string;
};

const MMSI_LEN = 9;
const FIELD_MAX = 64;

/** ITU-R M.585: nine-digit Maritime Mobile Service Identity. */
export function isValidMmsi(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length === MMSI_LEN && /^\d{9}$/.test(digits);
}

export function formatMmsiForMayday(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return isValidMmsi(digits) ? digits : null;
}

export function sanitizeVesselField(value: string, maxLen = FIELD_MAX): string {
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
}

function formatPositionLine(fix: LocationFix | null, coordFormat: CoordFormat): string {
  if (!fix) {
    return `${t('settings.position')}: ${t('map.awaitingGps')}`;
  }
  const coords = formatCoordinates(coordFormat, fix.latitude, fix.longitude);
  const ageSec = fixAgeSeconds(fix);
  if (isFixStale(fix)) {
    return `${t('settings.position')}: ${coords} (${t('map.staleCoordsHint')})`;
  }
  if (ageSec != null && ageSec > 0) {
    return `${t('settings.position')}: ${coords} (${t('map.fixAge', { sec: ageSec })})`;
  }
  return `${t('settings.position')}: ${coords}`;
}

export function buildMaydayMessage(
  vessel: VesselInfo,
  fix: LocationFix | null,
  coordFormat: CoordFormat,
): string {
  const name = sanitizeVesselField(vessel.name);
  const callSign = sanitizeVesselField(vessel.callSign);
  const mmsi = formatMmsiForMayday(vessel.mmsi);
  const homePort = sanitizeVesselField(vessel.homePort);

  const lines = [
    'MAYDAY MAYDAY MAYDAY',
    name ? `${t('settings.vesselName')}: ${name}` : null,
    callSign ? `${t('settings.callSign')}: ${callSign}` : null,
    mmsi ? `MMSI: ${mmsi}` : null,
    homePort ? `${t('settings.homePort')}: ${homePort}` : null,
    formatPositionLine(fix, coordFormat),
  ].filter(Boolean);
  return lines.join('\n');
}
