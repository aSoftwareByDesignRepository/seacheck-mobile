import type { CoordFormat } from '../settings/defaults';

function padMinutes(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  const dot = fixed.indexOf('.');
  if (dot === -1) return fixed.padStart(2, '0');
  return `${fixed.slice(0, dot).padStart(2, '0')}${fixed.slice(dot)}`;
}

function hemisphere(value: number, positive: string, negative: string): string {
  return value >= 0 ? positive : negative;
}

export function formatLatitude(format: CoordFormat, lat: number): string {
  const abs = Math.abs(lat);
  const hemi = hemisphere(lat, 'N', 'S');
  if (format === 'dd') return `${lat.toFixed(5)}°`;
  const degrees = Math.floor(abs);
  const minutes = (abs - degrees) * 60;
  if (format === 'ddm') return `${degrees}° ${padMinutes(minutes, 3)}' ${hemi}`;
  const wholeMinutes = Math.floor(minutes);
  const seconds = (minutes - wholeMinutes) * 60;
  return `${degrees}° ${wholeMinutes}' ${seconds.toFixed(1)}" ${hemi}`;
}

export function formatLongitude(format: CoordFormat, lon: number): string {
  const abs = Math.abs(lon);
  const hemi = hemisphere(lon, 'E', 'W');
  if (format === 'dd') return `${lon.toFixed(5)}°`;
  const degrees = Math.floor(abs);
  const minutes = (abs - degrees) * 60;
  if (format === 'ddm') return `${String(degrees).padStart(3, '0')}° ${padMinutes(minutes, 3)}' ${hemi}`;
  const wholeMinutes = Math.floor(minutes);
  const seconds = (minutes - wholeMinutes) * 60;
  return `${String(degrees).padStart(3, '0')}° ${wholeMinutes}' ${seconds.toFixed(1)}" ${hemi}`;
}

export function formatCoordinates(format: CoordFormat, lat: number, lon: number): string {
  return `${formatLatitude(format, lat)}, ${formatLongitude(format, lon)}`;
}

export function msToKnots(speedMs: number | null | undefined): number | null {
  if (speedMs == null || Number.isNaN(speedMs)) return null;
  return speedMs * 1.943_844;
}

export function formatSogKn(speedMs: number | null | undefined): string {
  const kn = msToKnots(speedMs);
  if (kn == null) return '—';
  return kn.toFixed(1);
}

export function formatCog(heading: number | null | undefined): string {
  if (heading == null || Number.isNaN(heading)) return '—';
  const normalized = ((heading % 360) + 360) % 360;
  return `${Math.round(normalized)}°`;
}
