import {
  addMapWaypointToPassage,
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
      },
    };
  }

  let mockDb = mockCreateDb();

  return {
    ...actual,
    withDatabaseTransaction: jest.fn(async (fn: (db: ReturnType<typeof mockCreateDb>) => Promise<void>) => {
      await fn(mockDb);
    }),
    __mockResetDb: () => {
      mockDb = mockCreateDb();
    },
    __mockDb: () => mockDb,
  };
});

const dbModule = jest.requireMock('../src/lib/db/database') as {
  __mockResetDb: () => void;
  __mockDb: () => { links: PassageLink[]; waypoints: unknown[] };
};

describe('addMapWaypointToPassage', () => {
  beforeEach(() => {
    resetAddMapWaypointLockForTests();
    resetPassageMapPlanningStoreForTests();
    dbModule.__mockResetDb();
    useWaypointStore.setState({ hydrated: true, items: [] });
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
      getPassageDetail: async (id: string) => {
        const passage = usePassageStore.getState().passages.find((p) => p.id === id);
        if (!passage) return null;
        const db = dbModule.__mockDb();
        const wps = db.links
          .filter((l) => l.passage_id === id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((l) => db.waypoints.find((w: { id: string }) => w.id === l.waypoint_id))
          .filter(Boolean);
        return { ...passage, waypoints: wps, legs: [], totalNm: 0, totalHours: 0 };
      },
      syncActivePassageNavigation: async () => {},
    });
    usePassageMapPlanningStore.getState().startPlanning('pass-1');
  });

  it('adds two waypoints sequentially without error', async () => {
    const wp1 = await addMapWaypointToPassage('pass-1', 54.1, 10.2);
    const wp2 = await addMapWaypointToPassage('pass-1', 54.2, 10.3);

    expect(wp1.id).not.toBe(wp2.id);
    const db = dbModule.__mockDb();
    expect(db.links).toHaveLength(2);
    expect(db.links[0]?.sort_order).toBe(0);
    expect(db.links[1]?.sort_order).toBe(1);
    expect(usePassageMapPlanningStore.getState().revision).toBe(2);
  });
});
