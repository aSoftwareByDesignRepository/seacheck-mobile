import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { create } from 'zustand';

import { getDatabase, newId, type TrackPointRow, type TrackRow } from '../lib/db/database';
import { computePathDistanceNm } from '../lib/geo/pathDistance';
import type { LonLat } from '../lib/geo/navigation';
import { t } from '../i18n';
import { registerTrackLiveTrail } from '../services/trackLiveTrail';
import { useNavigationStore } from './navigationStore';
import { usePassageStore } from './passageStore';

function buildDefaultTrackName(): string {
  const { activePassageId, passages } = usePassageStore.getState();
  const date = new Date().toISOString().slice(0, 10);
  if (activePassageId) {
    const passage = passages.find((p) => p.id === activePassageId);
    if (passage?.name) return `${passage.name} ${date}`;
  }
  return t('tracks.defaultName', { date });
}

const MAX_LIVE_TRAIL = 2000;
const MAX_LIVE_INSPECT = 500;

async function syncRecordingBackgroundGps(trackId: string | null): Promise<void> {
  const { syncRecordingBackgroundGps: sync } = await import('../services/backgroundLocationService');
  await sync(trackId);
}

type TrackStore = {
  hydrated: boolean;
  tracks: TrackRow[];
  recordingTrackId: string | null;
  /** Live polyline while recording — [lon, lat][] for map overlay. */
  liveTrail: LonLat[];
  /** Recent points with metadata for tap-to-inspect while recording. */
  liveInspectPoints: TrackPointRow[];
  hydrate: () => Promise<void>;
  startRecording: (name?: string) => Promise<string>;
  stopRecording: () => Promise<void>;
  appendPoint: (input: { latitude: number; longitude: number; sog_ms: number | null; cog_deg: number | null }) => Promise<void>;
  pushLiveTrailPoint: (longitude: number, latitude: number) => void;
  deleteTrack: (id: string) => Promise<void>;
  exportGpx: (id: string) => Promise<void>;
  /** Saved track polyline shown on map (from Tracks → Show on map). */
  mapPreviewTrackId: string | null;
  mapPreviewLine: LonLat[];
  mapPreviewPoints: TrackPointRow[];
  mapPreviewDistanceNm: number | null;
  setMapPreviewTrack: (id: string | null) => Promise<void>;
  getPoints: (id: string) => Promise<TrackPointRow[]>;
  getTrackDistanceNm: (id: string) => Promise<number>;
};

export const useTrackStore = create<TrackStore>((set, get) => ({
  hydrated: false,
  tracks: [],
  recordingTrackId: null,
  liveTrail: [],
  liveInspectPoints: [],
  mapPreviewTrackId: null,
  mapPreviewLine: [],
  mapPreviewPoints: [],
  mapPreviewDistanceNm: null,

  hydrate: async () => {
    const db = await getDatabase();
    const tracks = await db.getAllAsync<TrackRow>('SELECT * FROM tracks ORDER BY started_at DESC');
    const open = tracks.find((t) => t.ended_at == null);
    const recordingTrackId = open?.id ?? null;
    set({ hydrated: true, tracks, recordingTrackId });
    if (recordingTrackId) {
      await syncRecordingBackgroundGps(recordingTrackId);
      const points = await get().getPoints(recordingTrackId);
      set({
        liveTrail: points.map((p) => [p.longitude, p.latitude] as LonLat),
        liveInspectPoints: points.slice(-MAX_LIVE_INSPECT),
      });
    }
  },

  startRecording: async (name) => {
    if (get().recordingTrackId) return get().recordingTrackId!;
    const row: TrackRow = {
      id: newId('trk'),
      name: name?.trim() || buildDefaultTrackName(),
      started_at: Date.now(),
      ended_at: null,
    };
    const db = await getDatabase();
    await db.runAsync('INSERT INTO tracks (id, name, started_at, ended_at) VALUES (?, ?, ?, ?)', row.id, row.name, row.started_at, row.ended_at);
    set({ tracks: [row, ...get().tracks], recordingTrackId: row.id, liveTrail: [], liveInspectPoints: [] });
    await useNavigationStore.getState().resetSessionDistance();
    await syncRecordingBackgroundGps(row.id);
    return row.id;
  },

  stopRecording: async () => {
    const id = get().recordingTrackId;
    if (!id) return;
    const ended = Date.now();
    const db = await getDatabase();
    await db.runAsync('UPDATE tracks SET ended_at = ? WHERE id = ?', ended, id);
    set({
      recordingTrackId: null,
      tracks: get().tracks.map((t) => (t.id === id ? { ...t, ended_at: ended } : t)),
    });
    await syncRecordingBackgroundGps(null);
  },

  appendPoint: async ({ latitude, longitude, sog_ms, cog_deg }) => {
    const trackId = get().recordingTrackId;
    if (!trackId) return;
    const recorded_at = Date.now();
    const db = await getDatabase();
    const result = await db.runAsync(
      'INSERT INTO track_points (track_id, latitude, longitude, sog_ms, cog_deg, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
      trackId,
      latitude,
      longitude,
      sog_ms,
      cog_deg,
      recorded_at,
    );
    const point: TrackPointRow = {
      id: result.lastInsertRowId,
      track_id: trackId,
      latitude,
      longitude,
      sog_ms,
      cog_deg,
      recorded_at,
    };
    set((state) => {
      const nextInspect = [...state.liveInspectPoints, point];
      if (nextInspect.length > MAX_LIVE_INSPECT) nextInspect.splice(0, nextInspect.length - MAX_LIVE_INSPECT);
      return { liveInspectPoints: nextInspect };
    });
    get().pushLiveTrailPoint(longitude, latitude);
  },

  pushLiveTrailPoint: (longitude, latitude) => {
    const point: LonLat = [longitude, latitude];
    set((state) => {
      const next = [...state.liveTrail, point];
      if (next.length > MAX_LIVE_TRAIL) next.splice(0, next.length - MAX_LIVE_TRAIL);
      return { liveTrail: next };
    });
  },

  deleteTrack: async (id) => {
    const wasRecording = get().recordingTrackId === id;
    const wasPreview = get().mapPreviewTrackId === id;
    const db = await getDatabase();
    await db.runAsync('DELETE FROM tracks WHERE id = ?', id);
    set({
      tracks: get().tracks.filter((t) => t.id !== id),
      recordingTrackId: wasRecording ? null : get().recordingTrackId,
      liveTrail: wasRecording ? [] : get().liveTrail,
      liveInspectPoints: wasRecording ? [] : get().liveInspectPoints,
      mapPreviewTrackId: wasPreview ? null : get().mapPreviewTrackId,
      mapPreviewLine: wasPreview ? [] : get().mapPreviewLine,
      mapPreviewPoints: wasPreview ? [] : get().mapPreviewPoints,
      mapPreviewDistanceNm: wasPreview ? null : get().mapPreviewDistanceNm,
    });
    if (wasRecording) {
      await syncRecordingBackgroundGps(null);
    }
  },

  setMapPreviewTrack: async (id) => {
    if (!id) {
      set({ mapPreviewTrackId: null, mapPreviewLine: [], mapPreviewPoints: [], mapPreviewDistanceNm: null });
      return;
    }
    const points = await get().getPoints(id);
    set({
      mapPreviewTrackId: id,
      mapPreviewLine: points.map((p) => [p.longitude, p.latitude] as LonLat),
      mapPreviewPoints: points,
      mapPreviewDistanceNm: computePathDistanceNm(points),
    });
  },

  getTrackDistanceNm: async (id) => {
    const points = await get().getPoints(id);
    return computePathDistanceNm(points);
  },

  getPoints: async (id) => {
    const db = await getDatabase();
    return db.getAllAsync<TrackPointRow>(
      'SELECT * FROM track_points WHERE track_id = ? ORDER BY recorded_at ASC',
      id,
    );
  },

  exportGpx: async (id) => {
    const track = get().tracks.find((t) => t.id === id);
    if (!track) return;
    const points = await get().getPoints(id);
    const trkpts = points
      .map(
        (p) =>
          `<trkpt lat="${p.latitude.toFixed(6)}" lon="${p.longitude.toFixed(6)}"><time>${new Date(p.recorded_at).toISOString()}</time></trkpt>`,
      )
      .join('');
    const gpx = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="SeaCheck"><trk><name>${escapeXml(track.name)}</name><trkseg>${trkpts}</trkseg></trk></gpx>`;
    const path = `${FileSystem.cacheDirectory}seacheck-${id}.gpx`;
    await FileSystem.writeAsStringAsync(path, gpx);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/gpx+xml', dialogTitle: track.name });
    }
  },
}));

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

registerTrackLiveTrail({
  getRecordingTrackId: () => useTrackStore.getState().recordingTrackId,
  pushLiveTrailPoint: (longitude, latitude) => {
    useTrackStore.getState().pushLiveTrailPoint(longitude, latitude);
  },
});
