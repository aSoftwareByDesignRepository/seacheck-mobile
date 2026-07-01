import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { create } from 'zustand';

import { useNavigationStore } from './navigationStore';
import { usePassageMapPlanningStore } from './passageMapPlanningStore';

import { getDatabase, newId, withDatabaseTransaction, type PassageLegOverrideRow, type PassageRow, type WaypointRow } from '../lib/db/database';
import { buildPassageRouteGpx, buildPassageSummaryText } from '../lib/gpx/gpx';
import { t } from '../i18n';
import { useSettingsStore } from './settingsStore';
import {
  clampPlannedSogKn,
  computePassageLegs,
  legOverrideKey,
  type LegOverride,
  type PassageLeg,
} from '../lib/passage/computeLegs';

export type { PassageLeg } from '../lib/passage/computeLegs';

export type PassageWithLegs = PassageRow & {
  waypoints: WaypointRow[];
  legs: PassageLeg[];
  totalNm: number;
  totalHours: number;
};

type PassageStore = {
  hydrated: boolean;
  passages: PassageRow[];
  activePassageId: string | null;
  /** Bumps when any passage route geometry or order changes — refreshes map overlays. */
  routeRevision: number;
  hydrate: () => Promise<void>;
  createPassage: (name: string) => Promise<PassageRow>;
  deletePassage: (id: string) => Promise<void>;
  duplicatePassage: (id: string) => Promise<PassageRow>;
  addWaypointToPassage: (passageId: string, waypointId: string) => Promise<void>;
  removeWaypointFromPassage: (passageId: string, waypointId: string) => Promise<void>;
  reorderWaypointInPassage: (passageId: string, fromIndex: number, toIndex: number) => Promise<void>;
  setPassageMeta: (id: string, patch: Partial<Pick<PassageRow, 'name' | 'planned_departure' | 'default_sog_kn'>>) => Promise<void>;
  setLegOverride: (passageId: string, fromWaypointId: string, toWaypointId: string, patch: LegOverride) => Promise<void>;
  activatePassage: (id: string) => Promise<void>;
  deactivatePassage: () => Promise<void>;
  syncActivePassageNavigation: (passageId: string) => Promise<void>;
  setPassageActiveLeg: (legIndex: number) => Promise<void>;
  getPassageDetail: (id: string) => Promise<PassageWithLegs | null>;
  exportPassageGpx: (id: string) => Promise<void>;
  buildPassageSummary: (id: string) => Promise<string | null>;
  bumpRouteRevision: () => void;
};

async function loadPassageWaypoints(passageId: string): Promise<WaypointRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<WaypointRow>(
    `SELECT w.* FROM waypoints w
     INNER JOIN passage_waypoints pw ON pw.waypoint_id = w.id
     WHERE pw.passage_id = ?
     ORDER BY pw.sort_order ASC`,
    passageId,
  );
}

async function loadLegOverrides(passageId: string): Promise<Record<string, LegOverride>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PassageLegOverrideRow>(
    'SELECT * FROM passage_leg_overrides WHERE passage_id = ?',
    passageId,
  );
  const map: Record<string, LegOverride> = {};
  for (const row of rows) {
    const key = legOverrideKey(row.from_waypoint_id, row.to_waypoint_id);
    map[key] = {
      sogKn: row.sog_kn ?? undefined,
      note: row.note || undefined,
    };
  }
  return map;
}

async function persistLegOverride(
  passageId: string,
  fromWaypointId: string,
  toWaypointId: string,
  patch: LegOverride,
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<PassageLegOverrideRow>(
    'SELECT * FROM passage_leg_overrides WHERE passage_id = ? AND from_waypoint_id = ? AND to_waypoint_id = ?',
    passageId,
    fromWaypointId,
    toWaypointId,
  );
  const sogKn = patch.sogKn ?? existing?.sog_kn ?? null;
  const note = patch.note ?? existing?.note ?? '';
  if (sogKn == null && !note.trim()) {
    await db.runAsync(
      'DELETE FROM passage_leg_overrides WHERE passage_id = ? AND from_waypoint_id = ? AND to_waypoint_id = ?',
      passageId,
      fromWaypointId,
      toWaypointId,
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO passage_leg_overrides (passage_id, from_waypoint_id, to_waypoint_id, sog_kn, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(passage_id, from_waypoint_id, to_waypoint_id)
     DO UPDATE SET sog_kn = excluded.sog_kn, note = excluded.note`,
    passageId,
    fromWaypointId,
    toWaypointId,
    sogKn,
    note.trim(),
  );
}

async function rewriteWaypointOrder(passageId: string, orderedIds: string[], db?: Awaited<ReturnType<typeof getDatabase>>): Promise<void> {
  const conn = db ?? (await getDatabase());
  for (let i = 0; i < orderedIds.length; i++) {
    await conn.runAsync(
      'UPDATE passage_waypoints SET sort_order = ? WHERE passage_id = ? AND waypoint_id = ?',
      i,
      passageId,
      orderedIds[i],
    );
  }
}

async function syncPassageBackgroundMonitoring(): Promise<void> {
  try {
    const { syncBackgroundLocationMonitoring } = await import('../services/backgroundLocationService');
    await syncBackgroundLocationMonitoring();
  } catch (error) {
    console.warn('[passageStore] background monitoring sync failed', error);
  }
}

export const usePassageStore = create<PassageStore>((set, get) => ({
  hydrated: false,
  passages: [],
  activePassageId: null,
  routeRevision: 0,

  bumpRouteRevision: () => set((state) => ({ routeRevision: state.routeRevision + 1 })),

  hydrate: async () => {
    const db = await getDatabase();
    const passages = await db.getAllAsync<PassageRow>('SELECT * FROM passages ORDER BY created_at DESC');
    const active = passages.find((p) => p.is_active === 1);
    set({ hydrated: true, passages, activePassageId: active?.id ?? null });
  },

  createPassage: async (name) => {
    const row: PassageRow = {
      id: newId('pass'),
      name: name.trim() || t('passage.defaultName'),
      planned_departure: null,
      default_sog_kn: 5,
      is_active: 0,
      created_at: Date.now(),
    };
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO passages (id, name, planned_departure, default_sog_kn, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      row.id,
      row.name,
      row.planned_departure,
      row.default_sog_kn,
      row.is_active,
      row.created_at,
    );
    set({ passages: [row, ...get().passages] });
    return row;
  },

  deletePassage: async (id) => {
    const wasActive = get().activePassageId === id;
    if (usePassageMapPlanningStore.getState().passageId === id) {
      usePassageMapPlanningStore.getState().stopPlanning();
    }
    await withDatabaseTransaction(async (db) => {
      await db.runAsync('DELETE FROM passage_leg_overrides WHERE passage_id = ?', id);
      await db.runAsync('DELETE FROM passage_waypoints WHERE passage_id = ?', id);
      await db.runAsync('DELETE FROM passages WHERE id = ?', id);
    });
    set({
      passages: get().passages.filter((p) => p.id !== id),
      activePassageId: wasActive ? null : get().activePassageId,
    });
    if (wasActive) {
      const nav = useNavigationStore.getState();
      await nav.setGoTo(null);
      await nav.setActiveLegIndex(0);
      await syncPassageBackgroundMonitoring();
    }
  },

  duplicatePassage: async (id) => {
    const detail = await get().getPassageDetail(id);
    if (!detail) throw new Error('passage_not_found');
    const copyName = `${detail.name} (${t('passage.duplicateSuffix')})`;
    const row = await get().createPassage(copyName);
    for (const wp of detail.waypoints) {
      await get().addWaypointToPassage(row.id, wp.id);
    }
    await get().setPassageMeta(row.id, {
      planned_departure: detail.planned_departure,
      default_sog_kn: detail.default_sog_kn,
    });
    for (const leg of detail.legs) {
      if (leg.note || leg.sogKn !== detail.default_sog_kn) {
        await get().setLegOverride(row.id, leg.from.id, leg.to.id, {
          sogKn: leg.sogKn,
          note: leg.note,
        });
      }
    }
    return row;
  },

  addWaypointToPassage: async (passageId, waypointId) => {
    await withDatabaseTransaction(async (db) => {
      const existing = await db.getFirstAsync<{ c: number }>(
        'SELECT COUNT(*) as c FROM passage_waypoints WHERE passage_id = ? AND waypoint_id = ?',
        passageId,
        waypointId,
      );
      if (existing?.c) return;
      const maxRow = await db.getFirstAsync<{ m: number | null }>(
        'SELECT MAX(sort_order) as m FROM passage_waypoints WHERE passage_id = ?',
        passageId,
      );
      const sortOrder = (maxRow?.m ?? -1) + 1;
      await db.runAsync(
        'INSERT INTO passage_waypoints (passage_id, waypoint_id, sort_order) VALUES (?, ?, ?)',
        passageId,
        waypointId,
        sortOrder,
      );
    });
    await get().syncActivePassageNavigation(passageId);
    get().bumpRouteRevision();
  },

  removeWaypointFromPassage: async (passageId, waypointId) => {
    await withDatabaseTransaction(async (db) => {
      await db.runAsync('DELETE FROM passage_waypoints WHERE passage_id = ? AND waypoint_id = ?', passageId, waypointId);
      const remaining = await db.getAllAsync<WaypointRow>(
        `SELECT w.* FROM waypoints w
         INNER JOIN passage_waypoints pw ON pw.waypoint_id = w.id
         WHERE pw.passage_id = ?
         ORDER BY pw.sort_order ASC`,
        passageId,
      );
      await rewriteWaypointOrder(
        passageId,
        remaining.map((w) => w.id),
        db,
      );
    });
    await get().syncActivePassageNavigation(passageId);
    get().bumpRouteRevision();
  },

  reorderWaypointInPassage: async (passageId, fromIndex, toIndex) => {
    const waypoints = await loadPassageWaypoints(passageId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= waypoints.length || toIndex >= waypoints.length) return;
    if (fromIndex === toIndex) return;
    const next = [...waypoints];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await rewriteWaypointOrder(
      passageId,
      next.map((w) => w.id),
    );
    await get().syncActivePassageNavigation(passageId);
    get().bumpRouteRevision();
  },

  setPassageMeta: async (id, patch) => {
    const db = await getDatabase();
    const current = get().passages.find((p) => p.id === id);
    if (!current) return;
    const next = {
      ...current,
      ...patch,
      default_sog_kn: patch.default_sog_kn != null ? clampPlannedSogKn(patch.default_sog_kn, current.default_sog_kn) : current.default_sog_kn,
      name: patch.name != null ? patch.name.trim() || current.name : current.name,
    };
    await db.runAsync(
      'UPDATE passages SET name = ?, planned_departure = ?, default_sog_kn = ? WHERE id = ?',
      next.name,
      next.planned_departure,
      next.default_sog_kn,
      id,
    );
    set({ passages: get().passages.map((p) => (p.id === id ? next : p)) });
  },

  setLegOverride: async (passageId, fromWaypointId, toWaypointId, patch) => {
    const normalized: LegOverride = { ...patch };
    if (normalized.sogKn != null) {
      normalized.sogKn = clampPlannedSogKn(normalized.sogKn);
    }
    await persistLegOverride(passageId, fromWaypointId, toWaypointId, normalized);
  },

  activatePassage: async (id) => {
    const detail = await get().getPassageDetail(id);
    if (!detail || detail.waypoints.length < 2) {
      throw new Error('passage_need_two_waypoints');
    }
    await withDatabaseTransaction(async (db) => {
      await db.runAsync('UPDATE passages SET is_active = 0');
      await db.runAsync('UPDATE passages SET is_active = 1 WHERE id = ?', id);
    });
    set({
      activePassageId: id,
      passages: get().passages.map((p) => ({ ...p, is_active: p.id === id ? 1 : 0 })),
    });
    await useNavigationStore.getState().resetSessionDistance();
    await get().setPassageActiveLeg(0);
    await syncPassageBackgroundMonitoring();
  },

  setPassageActiveLeg: async (legIndex) => {
    const passageId = get().activePassageId;
    if (!passageId) return;
    const detail = await get().getPassageDetail(passageId);
    if (!detail || detail.legs.length === 0) return;
    const idx = Math.min(Math.max(0, legIndex), detail.legs.length - 1);
    await useNavigationStore.getState().setActiveLegIndex(idx);
    const leg = detail.legs[idx];
    await useNavigationStore.getState().setGoTo({
      id: leg.to.id,
      name: leg.to.name,
      latitude: leg.to.latitude,
      longitude: leg.to.longitude,
      kind: 'waypoint',
    });
  },

  deactivatePassage: async () => {
    const db = await getDatabase();
    await db.runAsync('UPDATE passages SET is_active = 0');
    set({
      activePassageId: null,
      passages: get().passages.map((p) => ({ ...p, is_active: 0 })),
    });
    const nav = useNavigationStore.getState();
    await nav.setGoTo(null);
    await nav.setActiveLegIndex(0);
    await syncPassageBackgroundMonitoring();
  },

  syncActivePassageNavigation: async (passageId) => {
    if (get().activePassageId !== passageId) return;
    const detail = await get().getPassageDetail(passageId);
    if (!detail || detail.waypoints.length < 2) {
      await get().deactivatePassage();
      return;
    }
    const nav = useNavigationStore.getState();
    const nextIdx = Math.min(nav.activeLegIndex, detail.legs.length - 1);
    await get().setPassageActiveLeg(nextIdx);
  },

  getPassageDetail: async (id) => {
    const passage = get().passages.find((p) => p.id === id);
    if (!passage) return null;
    const waypoints = await loadPassageWaypoints(id);
    const overrides = await loadLegOverrides(id);
    const legs = computePassageLegs(waypoints, passage.default_sog_kn, passage.planned_departure, overrides);
    const totalNm = legs.length ? legs[legs.length - 1].cumulativeNm : 0;
    const totalHours = legs.reduce((s, l) => s + l.durationHours, 0);
    return { ...passage, waypoints, legs, totalNm, totalHours };
  },

  exportPassageGpx: async (id) => {
    const detail = await get().getPassageDetail(id);
    if (!detail || detail.waypoints.length === 0) return;
    const distanceUnit = useSettingsStore.getState().distanceUnit;
    const gpx = buildPassageRouteGpx(
      detail.name,
      detail.waypoints.map((wp) => ({ name: wp.name, latitude: wp.latitude, longitude: wp.longitude, note: wp.note })),
      detail.legs.map((leg) => ({
        from: { name: leg.from.name, latitude: leg.from.latitude, longitude: leg.from.longitude },
        to: { name: leg.to.name, latitude: leg.to.latitude, longitude: leg.to.longitude },
        distanceNm: leg.distanceNm,
      })),
      { distanceUnit },
    );
    const path = `${FileSystem.cacheDirectory}seacheck-passage-${id}.gpx`;
    await FileSystem.writeAsStringAsync(path, gpx);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/gpx+xml', dialogTitle: detail.name });
    }
  },

  buildPassageSummary: async (id) => {
    const detail = await get().getPassageDetail(id);
    if (!detail) return null;
    return buildPassageSummaryText(
      detail.name,
      detail.legs.map((leg) => ({
        fromName: leg.from.name,
        toName: leg.to.name,
        bearingDeg: leg.bearingDeg,
        distanceNm: leg.distanceNm,
        cumulativeNm: leg.cumulativeNm,
        sogKn: leg.sogKn,
        durationHours: leg.durationHours,
        etaUtc: leg.etaUtc,
        note: leg.note,
      })),
      detail.totalNm,
      detail.totalHours,
      useSettingsStore.getState().distanceUnit,
    );
  },
}));
