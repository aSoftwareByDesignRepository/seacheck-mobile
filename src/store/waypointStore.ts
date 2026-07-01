import { create } from 'zustand';

import { getDatabase, newId, withDatabaseTransaction, type WaypointRow, type WaypointType } from '../lib/db/database';
import { notifyPassagePlanningChanged } from '../lib/passage/passageMapPlanning';
import { t } from '../i18n';
import { useNavigationStore, waypointToTarget } from './navigationStore';
import { usePassageStore } from './passageStore';

type WaypointStore = {
  hydrated: boolean;
  items: WaypointRow[];
  hydrate: () => Promise<void>;
  create: (input: { name: string; latitude: number; longitude: number; type?: WaypointType; note?: string }) => Promise<WaypointRow>;
  update: (id: string, patch: Partial<Pick<WaypointRow, 'name' | 'latitude' | 'longitude' | 'type' | 'note'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

async function syncNavigationAfterWaypointChange(id: string, next: WaypointRow | null) {
  const nav = useNavigationStore.getState();
  if (nav.goToTarget?.id === id && nav.goToTarget.kind === 'waypoint') {
    if (next) {
      await nav.setGoTo(waypointToTarget(next));
    } else {
      await nav.setGoTo(null);
    }
  }
}

export const useWaypointStore = create<WaypointStore>((set, get) => ({
  hydrated: false,
  items: [],

  hydrate: async () => {
    const db = await getDatabase();
    const rows = await db.getAllAsync<WaypointRow>('SELECT * FROM waypoints ORDER BY created_at DESC');
    set({ hydrated: true, items: rows });
  },

  create: async (input) => {
    const row: WaypointRow = {
      id: newId('wp'),
      name: input.name.trim() || t('waypoints.defaultName'),
      latitude: input.latitude,
      longitude: input.longitude,
      type: input.type ?? 'generic',
      note: input.note ?? '',
      created_at: Date.now(),
    };
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO waypoints (id, name, latitude, longitude, type, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      row.id,
      row.name,
      row.latitude,
      row.longitude,
      row.type,
      row.note,
      row.created_at,
    );
    set({ items: [row, ...get().items] });
    return row;
  },

  update: async (id, patch) => {
    const db = await getDatabase();
    const current = get().items.find((w) => w.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    await db.runAsync(
      'UPDATE waypoints SET name = ?, latitude = ?, longitude = ?, type = ?, note = ? WHERE id = ?',
      next.name,
      next.latitude,
      next.longitude,
      next.type,
      next.note,
      id,
    );
    set({ items: get().items.map((w) => (w.id === id ? next : w)) });
    await syncNavigationAfterWaypointChange(id, next);
    usePassageStore.getState().bumpRouteRevision();
  },

  remove: async (id) => {
    const db = await getDatabase();
    const passageLinks = await db.getAllAsync<{ passage_id: string }>(
      'SELECT passage_id FROM passage_waypoints WHERE waypoint_id = ?',
      id,
    );
    const passageIds = [...new Set(passageLinks.map((row) => row.passage_id))];

    for (const passageId of passageIds) {
      await usePassageStore.getState().removeWaypointFromPassage(passageId, id);
    }

    await withDatabaseTransaction(async (txn) => {
      await txn.runAsync(
        'DELETE FROM passage_leg_overrides WHERE from_waypoint_id = ? OR to_waypoint_id = ?',
        id,
        id,
      );
      await txn.runAsync('DELETE FROM waypoints WHERE id = ?', id);
    });

    set({ items: get().items.filter((w) => w.id !== id) });
    await syncNavigationAfterWaypointChange(id, null);

    for (const passageId of passageIds) {
      notifyPassagePlanningChanged(passageId);
    }

    if (passageIds.length === 0) {
      usePassageStore.getState().bumpRouteRevision();
    }
  },
}));
