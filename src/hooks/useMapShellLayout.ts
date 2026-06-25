import { useFormFactor } from './useFormFactor';
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

export function useMapShellLayout(): MapShellLayout {
  const { formFactor, isLandscape } = useFormFactor();
  const layoutPreset = useEffectiveLayoutPreset();

  const split =
    layoutPreset === 'split' ||
    layoutPreset === 'coordinates' ||
    (layoutPreset === 'map-forward' && formFactor === 'expanded') ||
    (layoutPreset === 'instruments-forward' && formFactor !== 'compact' && isLandscape);

  const row = split && (formFactor !== 'compact' || isLandscape);

  return {
    layoutPreset,
    split,
    row,
    coordinatesEmphasis: layoutPreset === 'coordinates',
  };
}
