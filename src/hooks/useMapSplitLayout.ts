import { useMemo } from 'react';

import { shouldSplitMapLayout } from '../lib/responsive/splitLayout';
import { useEffectiveLayoutPreset } from './useEffectiveLayoutPreset';
import { useFormFactor } from './useFormFactor';

/** Whether the map screen uses a side-by-side map + instrument panel. */
export function useMapSplitLayout(): boolean {
  const { formFactor, isLandscape, height } = useFormFactor();
  const layoutPreset = useEffectiveLayoutPreset();

  return useMemo(
    () => shouldSplitMapLayout(formFactor, isLandscape, layoutPreset, height),
    [formFactor, isLandscape, layoutPreset, height],
  );
}
