import { useMemo } from 'react';

import { effectiveMapSplit, isInstrumentPanelAllowed } from '../lib/map/mapScreenLayoutPolicy';
import { useCustomDownloadStore } from '../store/customDownloadStore';
import { useNavigationStore } from '../store/navigationStore';
import { usePassageMapPlanningStore } from '../store/passageMapPlanningStore';
import { useMapSplitLayout } from './useMapSplitLayout';

/** Whether the map screen is actually showing the side-by-side split (not merely capable). */
export function useEffectiveMapSplit(): boolean {
  const splitCapable = useMapSplitLayout();
  const customSelecting = useCustomDownloadStore((s) => s.selecting);
  const passageMapPlanning = usePassageMapPlanningStore((s) => s.passageId) != null;
  const mobTarget = useNavigationStore((s) => s.mobTarget);

  return useMemo(
    () =>
      effectiveMapSplit(
        splitCapable,
        isInstrumentPanelAllowed({
          customSelecting,
          passageMapPlanning,
          hasMobTarget: mobTarget != null,
        }),
      ),
    [splitCapable, customSelecting, passageMapPlanning, mobTarget],
  );
}
