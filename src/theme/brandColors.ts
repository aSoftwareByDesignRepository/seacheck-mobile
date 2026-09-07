/**
 * Brand / chart palette — single source for ThemeContext tokens and MapLibre paint.
 * Chart overlays stay fixed (legible on OSM water/land across UI themes); UI chrome
 * may resolve theme variants but shares the same brand primaries where they match.
 */
export const BRAND = {
  primary: '#0073ad',
  primarySoft: '#0073ad33',
  primaryMuted: '#7eb8d4',
  onPrimary: '#ffffff',
  accent: '#e65100',
  danger: '#c62828',
  dangerStrong: '#ba1b1b',
  success: '#0d7a4a',
  stale: '#6b7280',
  waterBg: '#aad3df',
} as const;

export type BrandColor = (typeof BRAND)[keyof typeof BRAND];
