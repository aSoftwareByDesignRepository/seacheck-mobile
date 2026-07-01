import { useMemo } from 'react';

import { computeMapSurfaceMode } from '../features/map/mapSurfaceMode';
import { useCustomDownloadStore } from '../store/customDownloadStore';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageMapPlanningStore } from '../store/passageMapPlanningStore';
import { useEffectiveLayoutPreset } from './useEffectiveLayoutPreset';
import { usePassageFollow } from './usePassageFollow';

/** Central map UI mode — dock, safety bar, and layout preset for chrome math. */
export function useMapSurfaceMode() {
  const layoutPreset = useEffectiveLayoutPreset();
  const customSelecting = useCustomDownloadStore((s) => s.selecting);
  const passageMapPlanning = usePassageMapPlanningStore((s) => s.passageId) != null;
  const mobTarget = useNavigationStore((s) => s.mobTarget);
  const screenLocked = useNavigationStore((s) => s.screenLocked);
  const follow = usePassageFollow();

  const showChartInInstrumentsOnly = customSelecting || passageMapPlanning || mobTarget != null;

  return useMemo(
    () =>
      computeMapSurfaceMode({
        layoutPreset,
        showChartInInstrumentsOnly,
        customSelecting,
        passageMapPlanning,
        mobTarget: mobTarget != null,
        screenLocked,
        passageFollowing: follow.following,
      }),
    [
      layoutPreset,
      showChartInInstrumentsOnly,
      customSelecting,
      passageMapPlanning,
      mobTarget,
      screenLocked,
      follow.following,
    ],
  );
}
