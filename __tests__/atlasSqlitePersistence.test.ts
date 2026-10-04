/**
 * ATLAS 3.5.14 durable-persistence proofs for the local SQLite layer.
 *
 * expo-sqlite is re-mocked here with a real `node:sqlite` DatabaseSync so the
 * shipping code path — lib/db/database.ts migrations + every SQL string in
 * waypointStore / passageStore / trackStore — executes against genuine SQLite
 * semantics: real INSERT/UPDATE/DELETE, real FK cascades, real re-reads after
 * write. Nothing is asserted from the zustand in-memory mirror alone; every
 * postcondition is re-read through the database handle.
 */
import { DatabaseSync } from 'node:sqlite';

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = jest.requireActual<{ DatabaseSync: any }>('node:sqlite');
  let db: any = null;

  const flatten = (args: any[]): any[] =>
    args.length === 1 && Array.isArray(args[0]) ? args[0] : args;

  const api = {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...params: any[]) => {
      const res = db.prepare(sql).run(...flatten(params));
      return { lastInsertRowId: Number(res.lastInsertRowid), changes: Number(res.changes) };
    },
    getAllAsync: async (sql: string, ...params: any[]) => db.prepare(sql).all(...flatten(params)),
    getFirstAsync: async (sql: string, ...params: any[]) =>
      (db.prepare(sql).get(...flatten(params)) as unknown) ?? null,
    withTransactionAsync: async (fn: (d: any) => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await fn(api);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return {
    openDatabaseAsync: jest.fn(async () => {
      if (!db) {
        db = new DatabaseSync(':memory:');
      }
      return api;
    }),
    __rawDb: () => db,
  };
});

import * as SQLite from 'expo-sqlite';

import { usePassageStore } from '../src/store/passageStore';
import { useTrackStore } from '../src/store/trackStore';
import { useWaypointStore } from '../src/store/waypointStore';

const rawDb = () => (SQLite as unknown as { __rawDb(): InstanceType<typeof DatabaseSync> }).__rawDb();

const all = <T>(sql: string, ...params: unknown[]): T[] =>
  rawDb().prepare(sql).all(...(params as never[])) as T[];

const one = <T>(sql: string, ...params: unknown[]): T | null =>
  (rawDb().prepare(sql).get(...(params as never[])) as T | undefined) ?? null;

function resetTables() {
  const db = rawDb();
  if (!db) return;
  db.exec(
    'DELETE FROM passage_leg_overrides; DELETE FROM passage_waypoints; ' +
      'DELETE FROM track_points; DELETE FROM tracks; DELETE FROM passages; DELETE FROM waypoints;',
  );
  useWaypointStore.setState({ hydrated: false, items: [] });
  usePassageStore.setState({ hydrated: false, passages: [], activePassageId: null, routeRevision: 0 });
  useTrackStore.setState({
    hydrated: false,
    tracks: [],
    recordingTrackId: null,
    liveTrail: [],
    liveInspectPoints: [],
    mapPreviewTrackId: null,
    mapPreviewLine: [],
    mapPreviewPoints: [],
    mapPreviewDistanceNm: null,
  });
}

beforeEach(resetTables);

describe('atlas durable persistence — waypoints (SQLite)', () => {
  it('create persists a row readable via SQL re-read; hydrate rebuilds state from disk', async () => {
    const wp = await useWaypointStore.getState().create({
      name: 'Kiel harbour',
      latitude: 54.32,
      longitude: 10.13,
      type: 'harbour',
      note: 'guest berth',
    });
    const row = one<{ name: string; type: string; note: string }>(
      'SELECT name, type, note FROM waypoints WHERE id = ?',
      wp.id,
    );
    expect(row).toEqual({ name: 'Kiel harbour', type: 'harbour', note: 'guest berth' });

    // Prove the store reads durable state, not its own mirror: mutate SQL-side then hydrate.
    rawDb().exec(`UPDATE waypoints SET name = 'Renamed via SQL' WHERE id = '${wp.id}'`);
    await useWaypointStore.getState().hydrate();
    expect(useWaypointStore.getState().items.find((w) => w.id === wp.id)?.name).toBe('Renamed via SQL');
  });

  it('create trims whitespace-only name to localized default — invalid input normalized', async () => {
    const wp = await useWaypointStore.getState().create({ name: '   ', latitude: 1, longitude: 2 });
    const row = one<{ name: string }>('SELECT name FROM waypoints WHERE id = ?', wp.id);
    expect(row?.name.length).toBeGreaterThan(0);
    expect(row?.name).not.toBe('   ');
  });

  it('update persists patch; update of unknown id is a no-op (not_found)', async () => {
    const wp = await useWaypointStore.getState().create({ name: 'A', latitude: 54, longitude: 10 });
    await useWaypointStore.getState().update(wp.id, { name: 'A2', latitude: 55 });
    expect(one<{ name: string; latitude: number }>('SELECT name, latitude FROM waypoints WHERE id = ?', wp.id)).toEqual({
      name: 'A2',
      latitude: 55,
    });

    const before = all<{ c: number }>('SELECT COUNT(*) AS c FROM waypoints');
    await useWaypointStore.getState().update('wp_nonexistent', { name: 'ghost' });
    expect(all<{ c: number }>('SELECT COUNT(*) AS c FROM waypoints')).toEqual(before);
  });

  it('remove deletes the row and cascades passage links + leg overrides', async () => {
    const w1 = await useWaypointStore.getState().create({ name: 'W1', latitude: 54.1, longitude: 10.1 });
    const w2 = await useWaypointStore.getState().create({ name: 'W2', latitude: 54.2, longitude: 10.2 });
    const w3 = await useWaypointStore.getState().create({ name: 'W3', latitude: 54.3, longitude: 10.3 });
    const passage = await usePassageStore.getState().createPassage('Cascade trip');
    await usePassageStore.getState().addWaypointToPassage(passage.id, w1.id);
    await usePassageStore.getState().addWaypointToPassage(passage.id, w2.id);
    await usePassageStore.getState().addWaypointToPassage(passage.id, w3.id);
    await usePassageStore.getState().setLegOverride(passage.id, w1.id, w2.id, { sogKn: 6.5, note: 'lock' });

    await useWaypointStore.getState().remove(w2.id);

    expect(one('SELECT id FROM waypoints WHERE id = ?', w2.id)).toBeNull();
    expect(all('SELECT waypoint_id FROM passage_waypoints WHERE waypoint_id = ?', w2.id)).toEqual([]);
    expect(
      all('SELECT * FROM passage_leg_overrides WHERE from_waypoint_id = ? OR to_waypoint_id = ?', w2.id, w2.id),
    ).toEqual([]);
    // Remaining members re-ordered contiguously.
    const members = all<{ waypoint_id: string; sort_order: number }>(
      'SELECT waypoint_id, sort_order FROM passage_waypoints WHERE passage_id = ? ORDER BY sort_order',
      passage.id,
    );
    expect(members.map((m) => m.waypoint_id)).toEqual([w1.id, w3.id]);
    expect(members.map((m) => m.sort_order)).toEqual([0, 1]);
  });
});

describe('atlas durable persistence — passages (SQLite)', () => {
  async function makePassageWithThreeWaypoints() {
    const passage = await usePassageStore.getState().createPassage('Kiel–Lübeck');
    const wps = [];
    for (let i = 0; i < 3; i += 1) {
      wps.push(await useWaypointStore.getState().create({ name: `P${i}`, latitude: 54 + i * 0.1, longitude: 10 + i * 0.1 }));
    }
    for (const wp of wps) await usePassageStore.getState().addWaypointToPassage(passage.id, wp.id);
    return { passage, wps };
  }

  it('create + membership persist with contiguous sort_order; duplicate add is idempotent (repeat)', async () => {
    const { passage, wps } = await makePassageWithThreeWaypoints();
    const members = all<{ waypoint_id: string; sort_order: number }>(
      'SELECT waypoint_id, sort_order FROM passage_waypoints WHERE passage_id = ? ORDER BY sort_order',
      passage.id,
    );
    expect(members.map((m) => m.waypoint_id)).toEqual(wps.map((w) => w.id));
    expect(members.map((m) => m.sort_order)).toEqual([0, 1, 2]);

    // Repeat mutation: re-adding the same waypoint must not create a second row.
    await usePassageStore.getState().addWaypointToPassage(passage.id, wps[1].id);
    const after = all<{ c: number }>(
      'SELECT COUNT(*) AS c FROM passage_waypoints WHERE passage_id = ? AND waypoint_id = ?',
      passage.id,
      wps[1].id,
    );
    expect(after[0].c).toBe(1);
  });

  it('setPassageMeta + setLegOverride persist; whitespace name keeps prior value (invalid)', async () => {
    const { passage, wps } = await makePassageWithThreeWaypoints();
    const dep = Date.UTC(2026, 5, 1, 8, 0, 0);
    await usePassageStore.getState().setPassageMeta(passage.id, { planned_departure: dep, default_sog_kn: 7 });
    await usePassageStore.getState().setLegOverride(passage.id, wps[0].id, wps[1].id, { sogKn: 4.2, note: 'shallow' });
    expect(
      one<{ planned_departure: number; default_sog_kn: number }>(
        'SELECT planned_departure, default_sog_kn FROM passages WHERE id = ?',
        passage.id,
      ),
    ).toEqual({ planned_departure: dep, default_sog_kn: 7 });
    expect(
      one<{ sog_kn: number; note: string }>(
        'SELECT sog_kn, note FROM passage_leg_overrides WHERE passage_id = ? AND from_waypoint_id = ? AND to_waypoint_id = ?',
        passage.id,
        wps[0].id,
        wps[1].id,
      ),
    ).toEqual({ sog_kn: 4.2, note: 'shallow' });

    await usePassageStore.getState().setPassageMeta(passage.id, { name: '   ' });
    expect(one<{ name: string }>('SELECT name FROM passages WHERE id = ?', passage.id)?.name).toBe('Kiel–Lübeck');
  });

  it('activate requires ≥2 waypoints — invalid activation leaves is_active unchanged (deny-of-invalid-state)', async () => {
    const empty = await usePassageStore.getState().createPassage('empty');
    await expect(usePassageStore.getState().activatePassage(empty.id)).rejects.toThrow('passage_need_two_waypoints');
    expect(one<{ is_active: number }>('SELECT is_active FROM passages WHERE id = ?', empty.id)?.is_active).toBe(0);

    const { passage } = await makePassageWithThreeWaypoints();
    await usePassageStore.getState().activatePassage(passage.id);
    expect(
      all<{ id: string; is_active: number }>('SELECT id, is_active FROM passages WHERE is_active = 1').map((r) => r.id),
    ).toEqual([passage.id]);
  });

  it('activate switches exclusivity; deactivate clears persisted flag', async () => {
    const a = await makePassageWithThreeWaypoints();
    const b = await makePassageWithThreeWaypoints();
    await usePassageStore.getState().activatePassage(a.passage.id);
    await usePassageStore.getState().activatePassage(b.passage.id);
    expect(all('SELECT id FROM passages WHERE is_active = 1').map((r: any) => r.id)).toEqual([b.passage.id]);
    await usePassageStore.getState().deactivatePassage();
    expect(all('SELECT id FROM passages WHERE is_active = 1')).toEqual([]);
  });

  it('reorder + reverse persist new sort_order', async () => {
    const { passage, wps } = await makePassageWithThreeWaypoints();
    await usePassageStore.getState().reorderWaypointInPassage(passage.id, 0, 2);
    expect(
      all<{ waypoint_id: string }>(
        'SELECT waypoint_id FROM passage_waypoints WHERE passage_id = ? ORDER BY sort_order',
        passage.id,
      ).map((m) => m.waypoint_id),
    ).toEqual([wps[1].id, wps[2].id, wps[0].id]);

    await usePassageStore.getState().reversePassageWaypoints(passage.id);
    expect(
      all<{ waypoint_id: string }>(
        'SELECT waypoint_id FROM passage_waypoints WHERE passage_id = ? ORDER BY sort_order',
        passage.id,
      ).map((m) => m.waypoint_id),
    ).toEqual([wps[0].id, wps[2].id, wps[1].id]);
  });

  it('deletePassage cascades membership + overrides; double delete is a no-op (repeat)', async () => {
    const { passage } = await makePassageWithThreeWaypoints();
    await usePassageStore.getState().setLegOverride(passage.id, 'x', 'y', { note: 'n' }).catch(() => {});
    await usePassageStore.getState().deletePassage(passage.id);
    expect(all('SELECT * FROM passages WHERE id = ?', passage.id)).toEqual([]);
    expect(all('SELECT * FROM passage_waypoints WHERE passage_id = ?', passage.id)).toEqual([]);
    expect(all('SELECT * FROM passage_leg_overrides WHERE passage_id = ?', passage.id)).toEqual([]);

    // Second delete of the same id — nothing resurrected, no throw.
    await usePassageStore.getState().deletePassage(passage.id);
    expect(all('SELECT * FROM passages')).toEqual([]);
  });

  it('duplicatePassage of unknown id throws not_found and persists nothing', async () => {
    const before = all<{ c: number }>('SELECT COUNT(*) AS c FROM passages')[0].c;
    await expect(usePassageStore.getState().duplicatePassage('pass_nonexistent')).rejects.toThrow('passage_not_found');
    expect(all<{ c: number }>('SELECT COUNT(*) AS c FROM passages')[0].c).toBe(before);
  });
});

describe('atlas durable persistence — tracks (SQLite)', () => {
  it('startRecording + appendPoint persist; stopRecording sets ended_at', async () => {
    const id = await useTrackStore.getState().startRecording('Morning sail');
    await useTrackStore.getState().appendPoint({ latitude: 54.3, longitude: 10.1, sog_ms: 2.5, cog_deg: 90 });
    await useTrackStore.getState().appendPoint({ latitude: 54.31, longitude: 10.11, sog_ms: null, cog_deg: null });
    await useTrackStore.getState().stopRecording();

    expect(one<{ name: string; ended_at: number | null }>('SELECT name, ended_at FROM tracks WHERE id = ?', id)?.name).toBe(
      'Morning sail',
    );
    expect(one<{ ended_at: number | null }>('SELECT ended_at FROM tracks WHERE id = ?', id)?.ended_at).not.toBeNull();
    const pts = all<{ latitude: number; sog_ms: number | null }>(
      'SELECT latitude, sog_ms FROM track_points WHERE track_id = ? ORDER BY recorded_at',
      id,
    );
    expect(pts).toHaveLength(2);
    expect(pts[1].sog_ms).toBeNull();
  });

  it('startRecording while recording returns existing id — no duplicate row (repeat)', async () => {
    const first = await useTrackStore.getState().startRecording();
    const second = await useTrackStore.getState().startRecording();
    expect(second).toBe(first);
    expect(all<{ c: number }>('SELECT COUNT(*) AS c FROM tracks')[0].c).toBe(1);
    await useTrackStore.getState().stopRecording();
  });

  it('appendPoint without active recording writes nothing (deny — write refused outside allowed state)', async () => {
    await useTrackStore.getState().appendPoint({ latitude: 54, longitude: 10, sog_ms: 1, cog_deg: 1 });
    expect(all<{ c: number }>('SELECT COUNT(*) AS c FROM track_points')[0].c).toBe(0);
  });

  it('exportGpx serializes persisted track points re-read from SQLite', async () => {
    const FileSystem = jest.requireMock('expo-file-system/legacy') as {
      writeAsStringAsync: jest.Mock;
      cacheDirectory: string;
    };
    FileSystem.writeAsStringAsync.mockClear();
    const id = await useTrackStore.getState().startRecording('Export me');
    await useTrackStore.getState().appendPoint({ latitude: 54.3, longitude: 10.1, sog_ms: 2.5, cog_deg: 90 });
    await useTrackStore.getState().stopRecording();

    await useTrackStore.getState().exportGpx(id);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [path, gpx] = FileSystem.writeAsStringAsync.mock.calls[0] as [string, string];
    expect(path).toContain(`seacheck-${id}.gpx`);
    expect(gpx).toContain('<name>Export me</name>');
    expect(gpx).toContain('lat="54.300000"');
    expect(gpx).toContain('lon="10.100000"');
  });

  it('deleteTrack FK-cascades track_points; deleting unknown id changes nothing (not_found)', async () => {
    const id = await useTrackStore.getState().startRecording();
    await useTrackStore.getState().appendPoint({ latitude: 54.3, longitude: 10.1, sog_ms: 2, cog_deg: 10 });
    await useTrackStore.getState().deleteTrack(id);
    expect(all('SELECT * FROM tracks WHERE id = ?', id)).toEqual([]);
    expect(all('SELECT * FROM track_points WHERE track_id = ?', id)).toEqual([]);
    expect(useTrackStore.getState().recordingTrackId).toBeNull();

    const counts = all<{ c: number }>('SELECT COUNT(*) AS c FROM tracks')[0].c;
    await useTrackStore.getState().deleteTrack('trk_nonexistent');
    expect(all<{ c: number }>('SELECT COUNT(*) AS c FROM tracks')[0].c).toBe(counts);
  });
});

describe('atlas durable persistence — schema invariants', () => {
  it('ship DDL declares all columns the stores write (entity/schema drift guard for the companion DB)', () => {
    const cols = (table: string) =>
      (all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name) as string[]).sort();
    expect(cols('waypoints')).toEqual(['created_at', 'id', 'latitude', 'longitude', 'name', 'note', 'type']);
    expect(cols('passages')).toEqual(['created_at', 'default_sog_kn', 'id', 'is_active', 'name', 'planned_departure']);
    expect(cols('passage_waypoints')).toEqual(['passage_id', 'sort_order', 'waypoint_id']);
    expect(cols('passage_leg_overrides')).toEqual([
      'from_waypoint_id',
      'note',
      'passage_id',
      'sog_kn',
      'to_waypoint_id',
    ]);
    expect(cols('tracks')).toEqual(['ended_at', 'id', 'name', 'started_at']);
    expect(cols('track_points')).toEqual(['cog_deg', 'id', 'latitude', 'longitude', 'recorded_at', 'sog_ms', 'track_id']);
    expect(cols('seamarks')).toEqual(['id', 'latitude', 'longitude', 'name', 'pack_id', 'tags_json', 'type']);
  });

  it('foreign keys are enforced — orphaned membership insert rejected (invalid)', async () => {
    const db = rawDb();
    expect(() =>
      db.prepare("INSERT INTO passage_waypoints (passage_id, waypoint_id, sort_order) VALUES ('nope', 'nope', 0)").run(),
    ).toThrow();
    expect(all<{ c: number }>('SELECT COUNT(*) AS c FROM passage_waypoints')[0].c).toBe(0);
  });
});
