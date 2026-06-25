import { useMemo } from 'react';

import { useFormFactor } from './useFormFactor';
import { resolveLayoutPreset } from '../lib/settings/layoutPreferences';
import { useSettingsStore } from '../store/settingsStore';
import type { LayoutPreset } from '../settings/defaults';

/** Layout preset for the current activity profile, form factor, and orientation. */
export function useEffectiveLayoutPreset(): LayoutPreset {
  const { formFactor, isLandscape } = useFormFactor();
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);
  const layoutOverrides = useSettingsStore((s) => s.layoutOverrides);

  return useMemo(
    () => resolveLayoutPreset(activityProfileId, formFactor, isLandscape, layoutOverrides),
    [activityProfileId, formFactor, isLandscape, layoutOverrides],
  );
}

export function useLayoutContext() {
  const { formFactor, isLandscape } = useFormFactor();
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);
  return useMemo(
    () => ({ profileId: activityProfileId, bucket: formFactor, isLandscape }),
    [activityProfileId, formFactor, isLandscape],
  );
}
