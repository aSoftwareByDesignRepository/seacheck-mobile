import { t } from '../../i18n';
import {
  newId,
  withDatabaseTransaction,
  type WaypointRow,
} from '../db/database';
import { requestConfirm } from '../../store/confirmStore';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { usePassageStore } from '../../store/passageStore';
import { useWaypointStore } from '../../store/waypointStore';

/** Serialises map waypoint adds/removes — one DB mutation at a time. */
let mapWaypointMutationLock: Promise<void> = Promise.resolve();

async function withMapWaypointMutation<T>(fn: () => Promise<T>): Promise<T> {
  await mapWaypointMutationLock;

  let releaseLock!: () => void;
  const slot = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const previous = mapWaypointMutationLock;
  mapWaypointMutationLock = slot;
  await previous;

  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

async function appendWaypointToPassageInTransaction(
  passageId: string,
  latitude: number,
  longitude: number,
  preferredName: string,
): Promise<WaypointRow> {
  let waypoint!: WaypointRow;

  await withDatabaseTransaction(async (db) => {
    const passage = await db.getFirstAsync<{ id: string }>('SELECT id FROM passages WHERE id = ?', passageId);
    if (!passage) throw new Error('passage_not_found');

    const countRow = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) as c FROM passage_waypoints WHERE passage_id = ?',
      passageId,
    );
    const index = (countRow?.c ?? 0) + 1;
    const label = preferredName || t('passage.mapWaypointName', { n: index });

    waypoint = {
      id: newId('wp'),
      name: label,
      latitude,
      longitude,
      type: 'generic',
      note: '',
      created_at: Date.now(),
    };

    await db.runAsync(
      'INSERT INTO waypoints (id, name, latitude, longitude, type, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      waypoint.id,
      waypoint.name,
      waypoint.latitude,
      waypoint.longitude,
      waypoint.type,
      waypoint.note,
      waypoint.created_at,
    );

    const maxRow = await db.getFirstAsync<{ m: number | null }>(
      'SELECT MAX(sort_order) as m FROM passage_waypoints WHERE passage_id = ?',
      passageId,
    );
    const sortOrder = (maxRow?.m ?? -1) + 1;
    await db.runAsync(
      'INSERT INTO passage_waypoints (passage_id, waypoint_id, sort_order) VALUES (?, ?, ?)',
      passageId,
      waypoint.id,
      sortOrder,
    );
  });

  useWaypointStore.setState((state) => ({ items: [waypoint, ...state.items] }));
  await usePassageStore.getState().syncActivePassageNavigation(passageId);
  usePassageStore.getState().bumpRouteRevision();
  usePassageMapPlanningStore.getState().bumpRevision();

  return waypoint;
}

export async function addMapWaypointToPassage(
  passageId: string,
  latitude: number,
  longitude: number,
  name?: string,
): Promise<WaypointRow> {
  return withMapWaypointMutation(async () => {
    const passage = usePassageStore.getState().passages.find((p) => p.id === passageId);
    if (!passage) throw new Error('passage_not_found');

    return appendWaypointToPassageInTransaction(
      passageId,
      latitude,
      longitude,
      name?.trim() ?? '',
    );
  });
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
    usePassageMapPlanningStore.getState().startPlanning(passage.id, { allowRouteEdits: true });
    await addMapWaypointToPassage(passage.id, latitude, longitude, t('passage.mapWaypointName', { n: 1 }));
    return passage.id;
  } catch (error) {
    usePassageMapPlanningStore.getState().stopPlanning();
    await usePassageStore.getState().deletePassage(passage.id);
    throw error;
  }
}

async function confirmSwitchPlanningPassage(passageId: string): Promise<boolean> {
  const activeId = usePassageMapPlanningStore.getState().passageId;
  if (!activeId || activeId === passageId) return true;
  return requestConfirm({
    title: t('passage.mapPlanningSwitchTitle'),
    message: t('passage.mapPlanningSwitchBody'),
    confirmLabel: t('passage.mapPlanningSwitchConfirm'),
    destructive: false,
  });
}

export async function startPassageMapPlanning(passageId: string): Promise<boolean> {
  if (!(await confirmSwitchPlanningPassage(passageId))) return false;

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

/** Open the chart to view a passage route — read-only; manage waypoints on the Passage screen. */
export async function startPassageMapView(passageId: string): Promise<boolean> {
  if (!(await confirmSwitchPlanningPassage(passageId))) return false;
  usePassageMapPlanningStore.getState().startPlanning(passageId, { allowRouteEdits: false });
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

/** Remove a waypoint from the passage being planned on the chart and delete the mark. */
export async function removeMapWaypointFromPassage(passageId: string, waypointId: string): Promise<void> {
  await withMapWaypointMutation(async () => {
    const detail = await usePassageStore.getState().getPassageDetail(passageId);
    if (!detail?.waypoints.some((wp) => wp.id === waypointId)) {
      throw new Error('waypoint_not_in_passage');
    }
    await useWaypointStore.getState().remove(waypointId);
  });
}

/** Move an existing passage waypoint to a new chart position while planning. */
export async function relocateMapWaypointInPassage(
  passageId: string,
  waypointId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await withMapWaypointMutation(async () => {
    const detail = await usePassageStore.getState().getPassageDetail(passageId);
    if (!detail?.waypoints.some((wp) => wp.id === waypointId)) {
      throw new Error('waypoint_not_in_passage');
    }
    await useWaypointStore.getState().update(waypointId, { latitude, longitude });
    notifyPassagePlanningChanged(passageId);
  });
}

/** Test-only — release any stuck mutation lock between tests. */
export function resetAddMapWaypointLockForTests(): void {
  mapWaypointMutationLock = Promise.resolve();
}
