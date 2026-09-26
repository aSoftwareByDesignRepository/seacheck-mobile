#!/usr/bin/env python3
"""Build deterministic SeaCheck demo databases for Play Store captures.

Creates, in --out-dir:

  seacheck.db   → pushed to <pkg>/files/SQLite/seacheck.db
                  • 5 waypoints on a realistic Baltic route Rostock→Kopenhagen
                  • 1 ACTIVE passage ("Rostock → Kopenhagen") linking them
                  • 1 completed track ("Warnemünde → Gedser") with points, so
                    the Tracks tab has content for the shot-05 capture
  RKStorage     → pushed to <pkg>/databases/RKStorage
                  • catalystLocalStorage['seacheck.settings.v1'] with a vessel
                    profile and a wider follow zoom so the route + a waypoint
                    marker are visible around the injected GPS fix
                  • onboardingCompleted is intentionally left unset — the
                    disclaimer step of onboarding is captured (shot 06).

The schema mirrors src/lib/db/database.ts exactly.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from pathlib import Path

SCHEMA = """
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
"""

RKSCHEMA = (
    "CREATE TABLE catalystLocalStorage ("
    "key TEXT PRIMARY KEY, value TEXT NOT NULL)"
)

# Rostock → Kopenhagen, the classic Fehmarn-Belt-free east route:
# Warnemünde out, around Gedser Odde, up Falster's east coast, past Stevns
# into København harbour. ~110 nm at 5.5 kn.
WAYPOINTS = [
    ("wp_demo_1", "Warnemünde",   54.1780, 12.0900, "harbour"),
    ("wp_demo_2", "Gedser Odde",  54.5650, 11.9700, "mark"),
    ("wp_demo_3", "Grønsund Øst", 54.9600, 12.1700, "mark"),
    ("wp_demo_4", "Stevns",       55.3100, 12.4600, "mark"),
    ("wp_demo_5", "København",    55.6900, 12.6000, "harbour"),
]

PASSAGE_ID = "passage_demo_rostock_kbh"
PASSAGE_NAME = "Rostock → Kopenhagen"
PASSAGE_SOG_KN = 5.5

# Completed log track along leg 1 (Warnemünde → just S of Gedser), ~3 h at
# ~5.4 kn. Track names are user data — identical across locales.
TRACK_ID = "track_demo_leg1"
TRACK_NAME = "Warnemünde → Gedser"
TRACK_POINTS = [
    (54.185, 12.055), (54.230, 12.040), (54.275, 12.030),
    (54.320, 12.020), (54.365, 12.010), (54.410, 12.000),
    (54.455, 11.990), (54.500, 11.985),
]

SETTINGS_KEY = "seacheck.settings.v1"
SETTINGS_PAYLOAD = {
    # No onboardingCompleted — the disclaimer walkthrough must still run.
    "vessel": {
        "name": "SY Möwe",
        "callSign": "DH7XM",
        "mmsi": "211123456",
        "homePort": "Rostock",
    },
    # Wider than the default 13 so the route polyline + waypoint markers are
    # visible around the injected fix during the map shots.
    "mapFollowZoom": 11,
    # Emulator has no Wi-Fi constraint, but keep the pack download unblocked
    # and the toggle visually consistent.
    "downloadWifiOnly": False,
}


def build_app_db(path: Path, now_ms: int) -> None:
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    try:
        con.executescript(SCHEMA)
        con.execute("PRAGMA foreign_keys = ON")
        for i, (wid, name, lat, lon, wtype) in enumerate(WAYPOINTS):
            con.execute(
                "INSERT INTO waypoints (id, name, latitude, longitude, type, note, created_at)"
                " VALUES (?, ?, ?, ?, ?, '', ?)",
                (wid, name, lat, lon, wtype, now_ms - (len(WAYPOINTS) - i) * 60_000),
            )
        departure_ms = now_ms + 14 * 3600_000  # tomorrow ~morning
        con.execute(
            "INSERT INTO passages (id, name, planned_departure, default_sog_kn, is_active, created_at)"
            " VALUES (?, ?, ?, ?, 1, ?)",
            (PASSAGE_ID, PASSAGE_NAME, departure_ms, PASSAGE_SOG_KN, now_ms),
        )
        for i, (wid, *_rest) in enumerate(WAYPOINTS):
            con.execute(
                "INSERT INTO passage_waypoints (passage_id, waypoint_id, sort_order)"
                " VALUES (?, ?, ?)",
                (PASSAGE_ID, wid, i),
            )
        started = now_ms - 30 * 3600_000  # ~30 h ago
        ended = started + 3 * 3600_000
        con.execute(
            "INSERT INTO tracks (id, name, started_at, ended_at) VALUES (?, ?, ?, ?)",
            (TRACK_ID, TRACK_NAME, started, ended),
        )
        step_ms = int((ended - started) / (len(TRACK_POINTS) - 1))
        for i, (lat, lon) in enumerate(TRACK_POINTS):
            con.execute(
                "INSERT INTO track_points (track_id, latitude, longitude, sog_ms, cog_deg, recorded_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (TRACK_ID, lat, lon, 2.8, 350.0, started + i * step_ms),
            )
        con.commit()
    finally:
        con.close()


def build_rkstorage(path: Path) -> None:
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    try:
        con.executescript(RKSCHEMA)
        # ReactDatabaseSupplier is a SQLiteOpenHelper with DATABASE_VERSION=1 —
        # onUpgrade() DELETES the whole DB when user_version mismatches.
        con.execute("PRAGMA user_version = 1")
        con.execute(
            "INSERT INTO catalystLocalStorage (key, value) VALUES (?, ?)",
            (SETTINGS_KEY, json.dumps(SETTINGS_PAYLOAD, ensure_ascii=False)),
        )
        con.commit()
    finally:
        con.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", required=True, type=Path)
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    now_ms = int(time.time() * 1000)
    app_db = args.out_dir / "seacheck.db"
    rk = args.out_dir / "RKStorage"
    build_app_db(app_db, now_ms)
    build_rkstorage(rk)
    # Sanity read-back
    con = sqlite3.connect(app_db)
    nwp = con.execute("SELECT COUNT(*) FROM waypoints").fetchone()[0]
    npa = con.execute("SELECT COUNT(*) FROM passages WHERE is_active=1").fetchone()[0]
    ntp = con.execute("SELECT COUNT(*) FROM track_points").fetchone()[0]
    con.close()
    print(f"seeded: waypoints={nwp} active_passages={npa} track_points={ntp}")
    print(f"wrote {app_db} and {rk}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
