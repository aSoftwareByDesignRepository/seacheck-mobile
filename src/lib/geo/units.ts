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

export function formatDistanceNm(distanceNm: number | null | undefined, unit: DistanceUnit, digits = 1): string {
  if (distanceNm == null || Number.isNaN(distanceNm)) return '—';
  return distanceFromNm(distanceNm, unit).toFixed(digits);
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
