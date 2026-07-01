import type { FormFactor } from '../../hooks/useFormFactor';
import type { LayoutPreset } from '../../settings/defaults';
import { LAYOUT_PRESETS, getActivityProfile } from '../../settings/profiles';

export function isLayoutPreset(value: unknown): value is LayoutPreset {
  return typeof value === 'string' && (LAYOUT_PRESETS as readonly string[]).includes(value);
}

/** Legacy presets removed in favour of the single stacked map + instruments layout. */
const LEGACY_LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  'instruments-forward': 'map-forward',
  split: 'map-forward',
  coordinates: 'map-forward',
};

export function normalizeLayoutPreset(value: unknown, fallback: LayoutPreset = 'map-forward'): LayoutPreset {
  if (typeof value === 'string' && value in LEGACY_LAYOUT_PRESETS) {
    return LEGACY_LAYOUT_PRESETS[value]!;
  }
  return isLayoutPreset(value) ? value : fallback;
}

export type LayoutContext = {
  profileId: string;
  bucket: FormFactor;
  isLandscape: boolean;
};

export function layoutContextKey(ctx: LayoutContext): string {
  return `${ctx.profileId}:${ctx.bucket}:${ctx.isLandscape ? 'landscape' : 'portrait'}`;
}

export function resolveLayoutPreset(
  profileId: string,
  bucket: FormFactor,
  isLandscape: boolean,
  overrides: Record<string, LayoutPreset>,
): LayoutPreset {
  const key = layoutContextKey({ profileId, bucket, isLandscape });
  const override = overrides[key];
  if (override) return override;
  return getActivityProfile(profileId)?.defaultLayout ?? 'map-forward';
}

export function nextLayoutPreset(current: LayoutPreset): LayoutPreset {
  const idx = LAYOUT_PRESETS.indexOf(current);
  const next = idx >= 0 ? (idx + 1) % LAYOUT_PRESETS.length : 0;
  return LAYOUT_PRESETS[next]!;
}
