import { getDatabase } from '../lib/db/database';
import { notifyTrackLiveTrailPoint } from './trackLiveTrail';

export type TrackPointInput = {
  latitude: number;
  longitude: number;
  sog_ms: number | null;
  cog_deg: number | null;
  recorded_at?: number;
};

/** Persist a track point from foreground or background GPS — no store imports. */
export async function appendTrackPointDirect(trackId: string, input: TrackPointInput): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO track_points (track_id, latitude, longitude, sog_ms, cog_deg, recorded_at) VALUES (?, ?, ?, ?, ?, ?)',
    trackId,
    input.latitude,
    input.longitude,
    input.sog_ms,
    input.cog_deg,
    input.recorded_at ?? Date.now(),
  );
  notifyTrackLiveTrailPoint(trackId, input.longitude, input.latitude);
}
