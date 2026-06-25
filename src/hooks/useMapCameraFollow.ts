import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';

import type { FollowZoomLevel } from '../settings/defaults';
import { distanceNm, type LonLat } from '../lib/geo/navigation';
import { displayCog, type LocationFix } from '../services/locationService';

const MIN_INTERVAL_MS = 400;
/** ~15 m — follow when moved enough to matter on chart. */
const MIN_MOVE_NM = 0.008;

type Options = {
  cameraRef: React.RefObject<CameraRef | null>;
  enabled: boolean;
  courseUp: boolean;
  followZoom: FollowZoomLevel;
  fix: LocationFix | null;
};

/** Drives map camera from expo-location — replaces MapLibre trackUserLocation native GPS. */
export function useMapCameraFollow({ cameraRef, enabled, courseUp, followZoom, fix }: Options) {
  const lastFollowMs = useRef(0);
  const lastCenter = useRef<LonLat | null>(null);

  useEffect(() => {
    if (!enabled || !fix) return;

    const center: LonLat = [fix.longitude, fix.latitude];
    const now = Date.now();
    let shouldUpdate = now - lastFollowMs.current >= MIN_INTERVAL_MS;

    if (lastCenter.current) {
      const moved = distanceNm(lastCenter.current, center);
      if (moved >= MIN_MOVE_NM) shouldUpdate = true;
    } else {
      shouldUpdate = true;
    }

    if (!shouldUpdate) return;

    lastFollowMs.current = now;
    lastCenter.current = center;

    const cog = displayCog(fix);
    const bearing = courseUp && cog != null ? cog : undefined;
    cameraRef.current?.easeTo({
      center,
      bearing,
      zoom: followZoom,
      duration: 280,
    });
  }, [cameraRef, enabled, courseUp, followZoom, fix?.latitude, fix?.longitude, fix?.heading, fix?.cogDeg, fix?.speedKn, fix?.timestamp]);
}
