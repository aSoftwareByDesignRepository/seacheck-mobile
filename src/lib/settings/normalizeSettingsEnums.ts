import type {
  BearingReference,
  CoordFormat,
  DistanceUnit,
  SogUnit,
} from '../../settings/defaults';
import { CRUISE_PASSAGE_DEFAULTS } from '../../settings/defaults';

const SOG_UNITS = new Set<SogUnit>(['kn', 'mph', 'kmh', 'ms']);
const DISTANCE_UNITS = new Set<DistanceUnit>(['nm', 'km', 'sm']);
const BEARING_REFS = new Set<BearingReference>(['true', 'magnetic']);
const COORD_FORMATS = new Set<CoordFormat>(['ddm', 'dd', 'dms']);

export function normalizeSogUnit(value: unknown, fallback: SogUnit = CRUISE_PASSAGE_DEFAULTS.sogUnit): SogUnit {
  return typeof value === 'string' && SOG_UNITS.has(value as SogUnit) ? (value as SogUnit) : fallback;
}

export function normalizeDistanceUnit(
  value: unknown,
  fallback: DistanceUnit = CRUISE_PASSAGE_DEFAULTS.distanceUnit,
): DistanceUnit {
  return typeof value === 'string' && DISTANCE_UNITS.has(value as DistanceUnit)
    ? (value as DistanceUnit)
    : fallback;
}

export function normalizeBearingReference(
  value: unknown,
  fallback: BearingReference = CRUISE_PASSAGE_DEFAULTS.bearingReference,
): BearingReference {
  return typeof value === 'string' && BEARING_REFS.has(value as BearingReference)
    ? (value as BearingReference)
    : fallback;
}

export function normalizeCoordFormat(
  value: unknown,
  fallback: CoordFormat = CRUISE_PASSAGE_DEFAULTS.coordFormat,
): CoordFormat {
  return typeof value === 'string' && COORD_FORMATS.has(value as CoordFormat)
    ? (value as CoordFormat)
    : fallback;
}
