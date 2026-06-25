import * as SQLite from 'expo-sqlite';

export type WaypointType = 'harbour' | 'anchorage' | 'mark' | 'hazard' | 'mob' | 'generic';

export type WaypointRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: WaypointType;
  note: string;
  created_at: number;
};

export type PassageRow = {
  id: string;
  name: string;
  planned_departure: number | null;
  default_sog_kn: number;
  is_active: number;
  created_at: number;
};

export type PassageWaypointRow = {
  passage_id: string;
  waypoint_id: string;
  sort_order: number;
};

export type PassageLegOverrideRow = {
  passage_id: string;
  from_waypoint_id: string;
  to_waypoint_id: string;
  sog_kn: number | null;
  note: string;
};

export type TrackRow = {
  id: string;
  name: string;
  started_at: number;
  ended_at: number | null;
};

export type TrackPointRow = {
  id: number;
  track_id: string;
  latitude: number;
  longitude: number;
  sog_ms: number | null;
  cog_deg: number | null;
  recorded_at: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function withDatabaseTransaction<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const db = await getDatabase();
  let result!: T;
  await db.withTransactionAsync(async () => {
    result = await fn(db);
  });
  return result;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('seacheck.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS waypoints (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'generic',
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS passages (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      planned_departure INTEGER,
      default_sog_kn REAL NOT NULL DEFAULT 5,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS passage_waypoints (
      passage_id TEXT NOT NULL,
      waypoint_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      PRIMARY KEY (passage_id, waypoint_id),
      FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE CASCADE,
      FOREIGN KEY (waypoint_id) REFERENCES waypoints(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS passage_leg_overrides (
      passage_id TEXT NOT NULL,
      from_waypoint_id TEXT NOT NULL,
      to_waypoint_id TEXT NOT NULL,
      sog_kn REAL,
      note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (passage_id, from_waypoint_id, to_waypoint_id),
      FOREIGN KEY (passage_id) REFERENCES passages(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS track_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      sog_ms REAL,
      cog_deg REAL,
      recorded_at INTEGER NOT NULL,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_track_points_track ON track_points(track_id, recorded_at);
    CREATE TABLE IF NOT EXISTS seamarks (
      id TEXT NOT NULL,
      pack_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (pack_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_seamarks_lat_lon ON seamarks(latitude, longitude);
  `);
  return db;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
