import { useCallback } from 'react';

import { layoutContextKey } from '../lib/settings/layoutPreferences';
import { useLayoutContext, useEffectiveLayoutPreset } from './useEffectiveLayoutPreset';
import { useNavigationStore } from '../store/navigationStore';
import { useSettingsStore } from '../store/settingsStore';

/** After MOB drop, switch from instruments-only to minimal map; restore on MOB clear. */
export function useMobLayoutSwitch() {
  const layoutPreset = useEffectiveLayoutPreset();
  const layoutCtx = useLayoutContext();
  const setLayoutOverride = useSettingsStore((s) => s.setLayoutOverride);

  return useCallback(() => {
    if (layoutPreset !== 'instruments-only') return;
    useNavigationStore.setState({
      mobLayoutRestoreContextKey: layoutContextKey(layoutCtx),
    });
    void setLayoutOverride('minimal', layoutCtx);
  }, [layoutPreset, layoutCtx, setLayoutOverride]);
}
