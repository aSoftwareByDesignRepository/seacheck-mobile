import { useEffect } from 'react';

import { displayCog, isFixStale, useLocationStore } from '../services/locationService';
import { useSettingsStore } from '../store/settingsStore';
import { useTrackStore } from '../store/trackStore';

/** Records GPS points while a track is active — works on any tab when background pipeline is off. */
export function useForegroundTrackRecording() {
  const recordingTrackId = useTrackStore((s) => s.recordingTrackId);
  const appendPoint = useTrackStore((s) => s.appendPoint);
  const backgroundTrackRecording = useSettingsStore((s) => s.backgroundTrackRecording);
  const permission = useLocationStore((s) => s.permission);

  const useBackgroundPipeline = backgroundTrackRecording && permission === 'background';

  useEffect(() => {
    if (!recordingTrackId || useBackgroundPipeline) return;

    const id = setInterval(() => {
      const current = useLocationStore.getState().fix;
      if (!current || isFixStale(current, 5000)) return;
      void appendPoint({
        latitude: current.latitude,
        longitude: current.longitude,
        sog_ms: current.speedMs,
        cog_deg: displayCog(current),
      });
    }, 2000);

    return () => clearInterval(id);
  }, [recordingTrackId, useBackgroundPipeline, appendPoint]);
}
