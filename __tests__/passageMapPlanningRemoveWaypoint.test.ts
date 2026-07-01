import {
  addMapWaypointToPassage,
  removeMapWaypointFromPassage,
  relocateMapWaypointInPassage,
  resetAddMapWaypointLockForTests,
} from '../src/lib/passage/passageMapPlanning';
import { resetPassageMapPlanningStoreForTests, usePassageMapPlanningStore } from '../src/store/passageMapPlanningStore';
import { usePassageStore } from '../src/store/passageStore';
import { useWaypointStore } from '../src/store/waypointStore';

type PassageLink = { passage_id: string; waypoint_id: string; sort_order: number };

jest.mock('../src/lib/db/database', () => {
  const actual = jest.requireActual('../src/lib/db/database');

  function mockCreateDb() {
    const waypoints: Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      type: string;
      note: string;
      created_at: number;
    }> = [];
    const links: PassageLink[] = [];

    return {
      waypoints,
      links,
      async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
        if (sql.includes('FROM passage_waypoints') && sql.includes('waypoint_id = ?')) {
          const waypointId = params[0] as string;
          return links
            .filter((l) => l.waypoint_id === waypointId)
            .map((l) => ({ passage_id: l.passage_id })) as T[];
        }
        if (sql.includes('FROM waypoints w') && sql.includes('passage_waypoints')) {
          const passageId = params[0] as string;
          return links
            .filter((l) => l.passage_id === passageId)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((l) => waypoints.find((w) => w.id === l.waypoint_id))
            .filter(Boolean) as T[];
        }
        return [];
      },
      async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
        if (sql.includes('FROM passages')) {
          return { id: params[0] } as T;
        }
        if (sql.includes('COUNT(*)')) {
          const passageId = params[0] as string;
          const c = links.filter((l) => l.passage_id === passageId).length;
          return { c } as T;
        }
        if (sql.includes('MAX(sort_order)')) {
          const passageId = params[0] as string;
          const orders = links.filter((l) => l.passage_id === passageId).map((l) => l.sort_order);
          const m = orders.length ? Math.max(...orders) : null;
          return { m } as T;
        }
        return null;
      },
      async runAsync(sql: string, ...params: unknown[]) {
        if (sql.includes('INSERT INTO waypoints')) {
          waypoints.push({
            id: params[0] as string,
            name: params[1] as string,
            latitude: params[2] as number,
            longitude: params[3] as number,
            type: params[4] as string,
            note: params[5] as string,
            created_at: params[6] as number,
          });
        }
        if (sql.includes('INSERT INTO passage_waypoints')) {
          links.push({
            passage_id: params[0] as string,
            waypoint_id: params[1] as string,
            sort_order: params[2] as number,
          });
        }
        if (sql.includes('DELETE FROM passage_waypoints')) {
          const passageId = params[0] as string;
          const waypointId = params[1] as string;
          const idx = links.findIndex((l) => l.passage_id === passageId && l.waypoint_id === waypointId);
          if (idx >= 0) links.splice(idx, 1);
        }
        if (sql.includes('UPDATE passage_waypoints SET sort_order')) {
          const sortOrder = params[0] as number;
          const passageId = params[1] as string;
          const waypointId = params[2] as string;
          const link = links.find((l) => l.passage_id === passageId && l.waypoint_id === waypointId);
          if (link) link.sort_order = sortOrder;
        }
        if (sql.includes('DELETE FROM passage_leg_overrides')) {
          // no-op for this test
        }
        if (sql.includes('DELETE FROM waypoints')) {
          const id = params[0] as string;
          const idx = waypoints.findIndex((w) => w.id === id);
          if (idx >= 0) waypoints.splice(idx, 1);
        }
      },
    };
  }

  let mockDb = mockCreateDb();

  return {
    ...actual,
    withDatabaseTransaction: jest.fn(async (fn: (db: ReturnType<typeof mockCreateDb>) => Promise<void>) => {
      await fn(mockDb);
    }),
    getDatabase: jest.fn(async () => mockDb),
    __mockResetDb: () => {
      mockDb = mockCreateDb();
    },
    __mockDb: () => mockDb,
  };
});

const dbModule = jest.requireMock('../src/lib/db/database') as {
  __mockResetDb: () => void;
  __mockDb: () => { links: PassageLink[]; waypoints: Array<{ id: string }> };
};

function installPassageStoreMocks() {
  usePassageStore.setState({
    hydrated: true,
    passages: [
      {
        id: 'pass-1',
        name: 'Test',
        planned_departure: null,
        default_sog_kn: 5,
        is_active: 0,
        created_at: 1,
      },
    ],
    activePassageId: null,
    routeRevision: 0,
    getPassageDetail: async (id: string) => {
      const passage = usePassageStore.getState().passages.find((p) => p.id === id);
      if (!passage) return null;
      const db = dbModule.__mockDb();
      const wps = db.links
        .filter((l) => l.passage_id === id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((l) => db.waypoints.find((w) => w.id === l.waypoint_id))
        .filter(Boolean);
      return { ...passage, waypoints: wps, legs: [], totalNm: 0, totalHours: 0 };
    },
    removeWaypointFromPassage: async (passageId: string, waypointId: string) => {
      const { getDatabase } = jest.requireMock('../src/lib/db/database') as { getDatabase: () => Promise<ReturnType<typeof dbModule.__mockDb>> };
      const db = await getDatabase();
      await db.runAsync('DELETE FROM passage_waypoints WHERE passage_id = ? AND waypoint_id = ?', passageId, waypointId);
      const remaining = await db.getAllAsync<{ id: string }>(
        `SELECT w.* FROM waypoints w
         INNER JOIN passage_waypoints pw ON pw.waypoint_id = w.id
         WHERE pw.passage_id = ?
         ORDER BY pw.sort_order ASC`,
        passageId,
      );
      for (let i = 0; i < remaining.length; i++) {
        await db.runAsync(
          'UPDATE passage_waypoints SET sort_order = ? WHERE passage_id = ? AND waypoint_id = ?',
          i,
          passageId,
          remaining[i]!.id,
        );
      }
      usePassageStore.getState().bumpRouteRevision();
    },
    syncActivePassageNavigation: async () => {},
    bumpRouteRevision: () => usePassageStore.setState((s) => ({ routeRevision: s.routeRevision + 1 })),
  });
}

describe('passage map waypoint mutations', () => {
  beforeEach(() => {
    resetAddMapWaypointLockForTests();
    resetPassageMapPlanningStoreForTests();
    dbModule.__mockResetDb();
    useWaypointStore.setState({ hydrated: true, items: [] });
    installPassageStoreMocks();
    usePassageMapPlanningStore.getState().startPlanning('pass-1');
  });

  it('adds two waypoints sequentially without error', async () => {
    const wp1 = await addMapWaypointToPassage('pass-1', 54.1, 10.2);
    const wp2 = await addMapWaypointToPassage('pass-1', 54.2, 10.3);

    expect(wp1.id).not.toBe(wp2.id);
    const db = dbModule.__mockDb();
    expect(db.links).toHaveLength(2);
    expect(usePassageMapPlanningStore.getState().revision).toBe(2);
  });

  it('removeMapWaypointFromPassage deletes mark, unlinks passage, and bumps planning revision', async () => {
    const wp1 = await addMapWaypointToPassage('pass-1', 54.1, 10.2);
    await addMapWaypointToPassage('pass-1', 54.2, 10.3);
    const revisionBefore = usePassageMapPlanningStore.getState().revision;

    await removeMapWaypointFromPassage('pass-1', wp1.id);

    const db = dbModule.__mockDb();
    expect(db.waypoints.some((w) => w.id === wp1.id)).toBe(false);
    expect(db.links.some((l) => l.waypoint_id === wp1.id)).toBe(false);
    expect(db.links).toHaveLength(1);
    expect(useWaypointStore.getState().items.some((w) => w.id === wp1.id)).toBe(false);
    expect(usePassageMapPlanningStore.getState().revision).toBeGreaterThan(revisionBefore);

    const detail = await usePassageStore.getState().getPassageDetail('pass-1');
    expect(detail?.waypoints).toHaveLength(1);
  });

  it('removeMapWaypointFromPassage rejects waypoints not in the passage', async () => {
    await expect(removeMapWaypointFromPassage('pass-1', 'missing-wp')).rejects.toThrow('waypoint_not_in_passage');
  });

  it('relocateMapWaypointInPassage updates coordinates and bumps planning revision', async () => {
    const wp1 = await addMapWaypointToPassage('pass-1', 54.1, 10.2);
    const revisionBefore = usePassageMapPlanningStore.getState().revision;

    await relocateMapWaypointInPassage('pass-1', wp1.id, 54.5, 10.6);

    const stored = useWaypointStore.getState().items.find((w) => w.id === wp1.id);
    expect(stored?.latitude).toBe(54.5);
    expect(stored?.longitude).toBe(10.6);
    expect(usePassageMapPlanningStore.getState().revision).toBeGreaterThan(revisionBefore);
  });
});
