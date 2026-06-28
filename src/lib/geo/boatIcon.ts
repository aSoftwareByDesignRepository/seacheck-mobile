import { destinationPoint, type LonLat } from './navigation';

/** Overall boat length on chart (~100 m) — readable at reference zoom (z13); scaled by zoom elsewhere. */
export const BOAT_ICON_LENGTH_NM = 0.054;

/** Maximum beam (~40 m). */
export const BOAT_ICON_BEAM_NM = 0.022;

/** Distance from GPS centre to bow tip — matches polygon geometry at scale 1. */
export const BOAT_BOW_OFFSET_NM = (BOAT_ICON_LENGTH_NM / 2) * 1.08;

export function scaledBoatBowOffsetNm(scale = 1): number {
  return BOAT_BOW_OFFSET_NM * scale;
}

/**
 * Navionics-style boat outline pointing along `bearingDeg` (true degrees, 0 = north).
 * Bow at the front, flat stern — direction is obvious without reading instruments.
 * `scale` adjusts NM size for chart zoom (screen-size compensation).
 */
export function buildBoatIconPolygon(center: LonLat, bearingDeg: number, scale = 1): LonLat[] {
  const halfLen = (BOAT_ICON_LENGTH_NM / 2) * scale;
  const halfBeam = (BOAT_ICON_BEAM_NM / 2) * scale;

  const bowTip = destinationPoint(center, bearingDeg, halfLen * 1.08);
  const bowShoulder = destinationPoint(center, bearingDeg, halfLen * 0.12);
  const portBow = destinationPoint(bowShoulder, bearingDeg - 90, halfBeam * 0.95);
  const starBow = destinationPoint(bowShoulder, bearingDeg + 90, halfBeam * 0.95);
  const sternCenter = destinationPoint(center, bearingDeg + 180, halfLen * 0.88);
  const portStern = destinationPoint(sternCenter, bearingDeg - 90, halfBeam * 0.62);
  const starStern = destinationPoint(sternCenter, bearingDeg + 90, halfBeam * 0.62);

  return [bowTip, starBow, starStern, sternCenter, portStern, portBow, bowTip];
}

/** Accuracy ring or circular marker — smooth circle in chart coordinates. */
export function buildPositionDotPolygon(center: LonLat, radiusNm = 0.012, steps = 16): LonLat[] {
  const ring: LonLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (360 * i) / steps;
    ring.push(destinationPoint(center, bearing, radiusNm));
  }
  return ring;
}

/**
 * Diamond marker when heading is unknown — visually distinct from the directional boat icon.
 * Standard chart convention: shape shows position, boat shape shows position + heading.
 */
export function buildPositionDiamondPolygon(center: LonLat, radiusNm = 0.014, scale = 1): LonLat[] {
  const r = radiusNm * scale;
  return [
    destinationPoint(center, 0, r * 1.15),
    destinationPoint(center, 90, r * 0.9),
    destinationPoint(center, 180, r * 1.15),
    destinationPoint(center, 270, r * 0.9),
    destinationPoint(center, 0, r * 1.15),
  ];
}
