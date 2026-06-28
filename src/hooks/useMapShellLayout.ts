import { useFormFactor, type FormFactor } from './useFormFactor';
import { useEffectiveLayoutPreset } from './useEffectiveLayoutPreset';
import type { LayoutPreset } from '../settings/defaults';

export type MapShellLayout = {
  layoutPreset: LayoutPreset;
  /** Side-by-side map + panel (tablet / landscape). */
  split: boolean;
  /** Row layout (map beside panel) vs stacked. */
  row: boolean;
  /** Emphasise live coordinates in the instrument panel. */
  coordinatesEmphasis: boolean;
};

/** Pure layout split rules — shared by ResponsiveMapShell and tests. */
export function resolveMapShellLayout(
  layoutPreset: LayoutPreset,
  formFactor: FormFactor,
  isLandscape: boolean,
): Pick<MapShellLayout, 'split' | 'row'> {
  const split =
    layoutPreset === 'split' ||
    layoutPreset === 'coordinates' ||
    (layoutPreset === 'map-forward' && formFactor !== 'compact') ||
    (layoutPreset === 'instruments-forward' && formFactor !== 'compact' && isLandscape);
  // instruments-only never splits — full-screen instruments, no chart
  const row = split && (formFactor !== 'compact' || isLandscape);
  return { split, row };
}

export function useMapShellLayout(): MapShellLayout {
  const { formFactor, isLandscape } = useFormFactor();
  const layoutPreset = useEffectiveLayoutPreset();
  const { split, row } = resolveMapShellLayout(layoutPreset, formFactor, isLandscape);

  return {
    layoutPreset,
    split,
    row,
    coordinatesEmphasis: layoutPreset === 'coordinates',
  };
}
