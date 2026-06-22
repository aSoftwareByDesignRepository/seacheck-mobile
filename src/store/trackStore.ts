import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { create } from 'zustand';

import { getDatabase, newId, type TrackPointRow, type TrackRow } from '../lib/db/database';
import { syncBackgroundTrackRecording } from '../services/trackRecordingService';

type TrackStore = {
  hydrated: boolean;
  tracks: TrackRow[];
  recordingTrackId: string | null;
  hydrate: () => Promise<void>;
  startRecording: (name?: string) => Promise<string>;
  stopRecording: () => Promise<void>;
  appendPoint: (input: { latitude: number; longitude: number; sog_ms: number | null; cog_deg: number | null }) => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;
  exportGpx: (id: string) => Promise<void>;
  getPoints: (id: string) => Promise<TrackPointRow[]>;
};

export const useTrackStore = create<TrackStore>((set, get) => ({
  hydrated: false,
  tracks: [],
  recordingTrackId: null,

  hydrate: async () => {
    const db = await getDatabase();
    const tracks = await db.getAllAsync<TrackRow>('SELECT * FROM tracks ORDER BY started_at DESC');
    const open = tracks.find((t) => t.ended_at == null);
    const recordingTrackId = open?.id ?? null;
    set({ hydrated: true, tracks, recordingTrackId });
    if (recordingTrackId) {
      await syncBackgroundTrackRecording(recordingTrackId);
    }
  },

  startRecording: async (name) => {
    if (get().recordingTrackId) return get().recordingTrackId!;
    const row: TrackRow = {
      id: newId('trk'),
      name: name?.trim() || `Track ${new Date().toISOString().slice(0, 10)}`,
      started_at: Date.now(),
      ended_at: null,
    };
    const db = await getDatabase();
    await db.runAsync('INSERT INTO tracks (id, name, started_at, ended_at) VALUES (?, ?, ?, ?)', row.id, row.name, row.started_at, row.ended_at);
    set({ tracks: [row, ...get().tracks], recordingTrackId: row.id });
    await syncBackgroundTrackRecording(row.id);
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
    await syncBackgroundTrackRecording(null);
  },

  appendPoint: async ({ latitude, longitude, sog_ms, cog_deg }) => {
    const trackId = get().recordingTrackId;
    if (!trackId) return;
    const db = await getDatabase();
    await db.runAsync(
      'INSERT INTO track_points (track_id, latitude, longitude, sog_ms, cog_deg, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
      trackId,
      latitude,
      longitude,
      sog_ms,
      cog_deg,
      Date.now(),
    );
  },

  deleteTrack: async (id) => {
    const wasRecording = get().recordingTrackId === id;
    const db = await getDatabase();
    await db.runAsync('DELETE FROM tracks WHERE id = ?', id);
    set({
      tracks: get().tracks.filter((t) => t.id !== id),
      recordingTrackId: wasRecording ? null : get().recordingTrackId,
    });
    if (wasRecording) {
      await syncBackgroundTrackRecording(null);
    }
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
