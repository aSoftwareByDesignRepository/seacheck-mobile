import { create } from 'zustand';

import { getDatabase, newId, type WaypointRow, type WaypointType } from '../lib/db/database';

type WaypointStore = {
  hydrated: boolean;
  items: WaypointRow[];
  hydrate: () => Promise<void>;
  create: (input: { name: string; latitude: number; longitude: number; type?: WaypointType; note?: string }) => Promise<WaypointRow>;
  update: (id: string, patch: Partial<Pick<WaypointRow, 'name' | 'latitude' | 'longitude' | 'type' | 'note'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

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
      name: input.name.trim() || 'Waypoint',
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
  },

  remove: async (id) => {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM waypoints WHERE id = ?', id);
    set({ items: get().items.filter((w) => w.id !== id) });
  },
}));
