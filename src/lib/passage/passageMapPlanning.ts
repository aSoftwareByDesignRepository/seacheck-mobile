import { t } from '../../i18n';
import { requestConfirm } from '../../store/confirmStore';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { usePassageStore } from '../../store/passageStore';
import { useWaypointStore } from '../../store/waypointStore';

export async function addMapWaypointToPassage(passageId: string, latitude: number, longitude: number, name?: string) {
  const detail = await usePassageStore.getState().getPassageDetail(passageId);
  const index = (detail?.waypoints.length ?? 0) + 1;
  const waypoint = await useWaypointStore.getState().create({
    name: name?.trim() || t('passage.mapWaypointName', { n: index }),
    latitude,
    longitude,
    type: 'generic',
  });
  await usePassageStore.getState().addWaypointToPassage(passageId, waypoint.id);
  usePassageMapPlanningStore.getState().bumpRevision();
  return waypoint;
}

export async function startNewPassageFromMap(latitude: number, longitude: number): Promise<string | null> {
  const activeId = usePassageMapPlanningStore.getState().passageId;
  if (activeId) {
    const ok = await requestConfirm({
      title: t('passage.mapPlanningSwitchTitle'),
      message: t('passage.mapPlanningSwitchBody'),
      confirmLabel: t('passage.mapPlanningSwitchConfirm'),
      destructive: false,
    });
    if (!ok) return null;
  }
  const passage = await usePassageStore.getState().createPassage(t('passage.defaultName'));
  try {
    await addMapWaypointToPassage(passage.id, latitude, longitude, t('passage.mapWaypointName', { n: 1 }));
    usePassageMapPlanningStore.getState().startPlanning(passage.id, { allowRouteEdits: true });
    return passage.id;
  } catch (error) {
    await usePassageStore.getState().deletePassage(passage.id);
    throw error;
  }
}

export async function startPassageMapPlanning(passageId: string): Promise<boolean> {
  const activeId = usePassageMapPlanningStore.getState().passageId;
  if (activeId && activeId !== passageId) {
    const ok = await requestConfirm({
      title: t('passage.mapPlanningSwitchTitle'),
      message: t('passage.mapPlanningSwitchBody'),
      confirmLabel: t('passage.mapPlanningSwitchConfirm'),
      destructive: false,
    });
    if (!ok) return false;
  }

  const activePassageId = usePassageStore.getState().activePassageId;
  const isActivePassage = passageId === activePassageId;
  if (isActivePassage) {
    const ok = await requestConfirm({
      title: t('passage.mapPlanningActiveTitle'),
      message: t('passage.mapPlanningActiveBody'),
      confirmLabel: t('passage.mapPlanningActiveConfirm'),
      cancelLabel: t('common.dismiss'),
      destructive: false,
    });
    if (!ok) return false;
  }

  usePassageMapPlanningStore.getState().startPlanning(passageId, { allowRouteEdits: !isActivePassage });
  return true;
}

export async function unlockActivePassageRouteEdits(): Promise<boolean> {
  const ok = await requestConfirm({
    title: t('passage.mapPlanningUnlockTitle'),
    message: t('passage.mapPlanningUnlockBody'),
    confirmLabel: t('passage.mapPlanningUnlockConfirm'),
    cancelLabel: t('common.dismiss'),
    destructive: true,
  });
  if (!ok) return false;
  usePassageMapPlanningStore.getState().unlockRouteEdits();
  return true;
}

export function stopPassageMapPlanning() {
  usePassageMapPlanningStore.getState().stopPlanning();
}

export function isPassageMapPlanningActive(): boolean {
  return usePassageMapPlanningStore.getState().passageId != null;
}

export function isPlanningActivePassage(): boolean {
  const { passageId } = usePassageMapPlanningStore.getState();
  if (!passageId) return false;
  return usePassageStore.getState().activePassageId === passageId;
}

/** Refresh chart overlay and map panel after passage edits outside map taps. */
export function notifyPassagePlanningChanged(passageId: string): void {
  if (usePassageMapPlanningStore.getState().passageId === passageId) {
    usePassageMapPlanningStore.getState().bumpRevision();
  }
}
