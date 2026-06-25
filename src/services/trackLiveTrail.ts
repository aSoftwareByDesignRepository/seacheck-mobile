type LiveTrailSink = {
  getRecordingTrackId: () => string | null;
  pushLiveTrailPoint: (longitude: number, latitude: number) => void;
};

let sink: LiveTrailSink | null = null;

/** Registered by trackStore — keeps live trail updates out of the background GPS task module. */
export function registerTrackLiveTrail(next: LiveTrailSink | null): void {
  sink = next;
}

export function notifyTrackLiveTrailPoint(trackId: string, longitude: number, latitude: number): void {
  if (!sink || sink.getRecordingTrackId() !== trackId) return;
  sink.pushLiveTrailPoint(longitude, latitude);
}
