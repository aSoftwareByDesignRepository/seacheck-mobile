import type { DistanceUnit, SogUnit } from '../../settings/defaults';
import { msToKnots } from './navigation';

const MS_TO_KMH = 3.6;
const MS_TO_MPH = 2.236_936;
const NM_TO_KM = 1.852;
const NM_TO_SM = 1.150_78;

export function sogFromMs(speedMs: number | null | undefined, unit: SogUnit): number | null {
  if (speedMs == null || Number.isNaN(speedMs)) return null;
  switch (unit) {
    case 'kn':
      return msToKnots(speedMs);
    case 'kmh':
      return speedMs * MS_TO_KMH;
    case 'mph':
      return speedMs * MS_TO_MPH;
    case 'ms':
      return speedMs;
    default:
      return msToKnots(speedMs);
  }
}

export function formatSog(speedMs: number | null | undefined, unit: SogUnit): string {
  const value = sogFromMs(speedMs, unit);
  if (value == null) return '—';
  const digits = unit === 'ms' ? 2 : 1;
  return value.toFixed(digits);
}

export function distanceFromNm(distanceNm: number, unit: DistanceUnit): number {
  switch (unit) {
    case 'nm':
      return distanceNm;
    case 'km':
      return distanceNm * NM_TO_KM;
    case 'sm':
      return distanceNm * NM_TO_SM;
    default:
      return distanceNm;
  }
}

/** Convert a user-entered distance back to nautical miles for internal storage. */
export function distanceToNm(value: number, unit: DistanceUnit): number {
  switch (unit) {
    case 'km':
      return value / NM_TO_KM;
    case 'sm':
      return value / NM_TO_SM;
    default:
      return value;
  }
}

export function formatDistanceNm(distanceNm: number | null | undefined, unit: DistanceUnit, digits = 1): string {
  if (distanceNm == null || Number.isNaN(distanceNm)) return '—';
  return distanceFromNm(distanceNm, unit).toFixed(digits);
}

/** Average speed from cumulative distance and elapsed time. */
export function avgSpeedFromSession(distanceNm: number, elapsedMs: number, unit: SogUnit): string {
  if (elapsedMs <= 0 || distanceNm <= 0) return '—';
  const hours = elapsedMs / 3_600_000;
  const kn = distanceNm / hours;
  const ms = (kn * 1852) / 3600;
  return formatSog(ms, unit);
}

export function distanceUnitLabel(unit: DistanceUnit): string {
  switch (unit) {
    case 'nm':
      return 'NM';
    case 'km':
      return 'km';
    case 'sm':
      return 'SM';
    default:
      return unit;
  }
}

/** Cross-track error for instrument cells — internal value stays in NM. */
export function formatXteFromNm(
  xteNm: number | null | undefined,
  unit: DistanceUnit,
  side: 'L' | 'R' | null = null,
  digits = 2,
): { value: string; unitLabel: string } {
  if (xteNm == null || Number.isNaN(xteNm)) {
    return { value: '—', unitLabel: '' };
  }
  const sideSuffix = side ? ` ${side}` : '';
  return {
    value: formatDistanceNm(xteNm, unit, digits),
    unitLabel: `${distanceUnitLabel(unit)}${sideSuffix}`,
  };
}

/** Single-line XTE for compact banners and alarm copy. */
export function formatXteLineFromNm(
  xteNm: number | null | undefined,
  unit: DistanceUnit,
  side: 'L' | 'R' | null = null,
  digits = 2,
): string | null {
  if (xteNm == null || Number.isNaN(xteNm)) return null;
  const { value, unitLabel } = formatXteFromNm(xteNm, unit, side, digits);
  return `${value} ${unitLabel}`.trim();
}

/** Single-line distance for alarm notifications — internal math stays in NM. */
export function formatDistanceLineFromNm(
  distanceNm: number | null | undefined,
  unit: DistanceUnit,
  digits = 2,
): string | null {
  if (distanceNm == null || Number.isNaN(distanceNm)) return null;
  return `${formatDistanceNm(distanceNm, unit, digits)} ${distanceUnitLabel(unit)}`;
}
