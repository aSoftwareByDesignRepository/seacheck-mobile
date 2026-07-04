import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { validateDownloadBounds } from '../map/bounds';

export type PersistedIndexEntry = {
  packId: string;
  name?: string;
  custom?: boolean;
  bounds?: LngLatBounds;
  minZoom?: number;
  maxZoom?: number;
  seamarksIndexed?: boolean;
};

export type PersistedIndex = Record<string, PersistedIndexEntry>;

const MAX_NAME_LENGTH = 120;
const MIN_ZOOM = 0;
const MAX_ZOOM = 19;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

function sanitizeBounds(value: unknown): LngLatBounds | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  const [west, south, east, north] = value;
  if (![west, south, east, north].every(isFiniteNumber)) return undefined;
  if (west < -180 || east > 180 || south < -90 || north > 90) return undefined;
  if (west >= east || south >= north) return undefined;
  return [west, south, east, north];
}

function sanitizeZoom(value: unknown, fallback: number): number {
  if (!isFiniteNumber(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < MIN_ZOOM || rounded > MAX_ZOOM) return fallback;
  return rounded;
}

function isValidPackId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}

/** Drop malformed or unsafe persisted index rows — protects hydrate and retry paths. */
export function sanitizePersistedIndex(raw: unknown): PersistedIndex {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const sanitized: PersistedIndex = {};
  for (const [regionId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof regionId !== 'string' || !regionId.trim() || regionId.length > 128) continue;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

    const row = entry as Record<string, unknown>;
    if (!isValidPackId(row.packId)) continue;

    const bounds = sanitizeBounds(row.bounds);
    const minZoom = sanitizeZoom(row.minZoom, 10);
    const maxZoom = sanitizeZoom(row.maxZoom, 14);
    const custom = row.custom === true;

    if (custom && bounds && minZoom > maxZoom) continue;

    if (custom && bounds) {
      const validation = validateDownloadBounds(bounds, minZoom, maxZoom);
      if (!validation.ok) continue;
    }

    sanitized[regionId] = {
      packId: row.packId.trim(),
      name: sanitizeName(row.name),
      custom: custom || undefined,
      bounds,
      minZoom: bounds ? minZoom : undefined,
      maxZoom: bounds ? maxZoom : undefined,
      seamarksIndexed: row.seamarksIndexed === true || undefined,
    };
  }

  return sanitized;
}
