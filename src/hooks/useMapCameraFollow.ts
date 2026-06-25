import type { CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useRef } from 'react';

import type { FollowZoomLevel } from '../settings/defaults';
import {
  cameraFollowDuration,
  evaluateCameraFollow,
} from '../lib/map/mapCameraFollow';
import type { LocationFix } from '../services/locationService';

type Options = {
  cameraRef: React.RefObject<CameraRef | null>;
  enabled: boolean;
  /** Chart style finished loading — camera commands are unreliable before this. */
  mapReady: boolean;
  courseUp: boolean;
  followZoom: FollowZoomLevel;
  fix: LocationFix | null;
};

/** Drives map camera from expo-location — replaces MapLibre trackUserLocation native GPS. */
export function useMapCameraFollow({ cameraRef, enabled, mapReady, courseUp, followZoom, fix }: Options) {
  const lastFollowMs = useRef(0);
  const lastCenter = useRef<[number, number] | null>(null);
  const hasInitialCentered = useRef(false);

  useEffect(() => {
    if (!enabled || !mapReady) {
      lastCenter.current = null;
      lastFollowMs.current = 0;
      hasInitialCentered.current = false;
    }
  }, [enabled, mapReady]);

  useEffect(() => {
    const decision = evaluateCameraFollow({
      enabled,
      mapReady,
      fix,
      courseUp,
      followZoom,
      nowMs: Date.now(),
      lastFollowMs: lastFollowMs.current,
      lastCenter: lastCenter.current,
      hasInitialCentered: hasInitialCentered.current,
    });
    if (!decision) return;

    lastFollowMs.current = Date.now();
    lastCenter.current = decision.center;
    hasInitialCentered.current = true;

    cameraRef.current?.easeTo({
      center: decision.center,
      bearing: decision.bearing,
      zoom: followZoom,
      duration: cameraFollowDuration(decision.isInitialCenter),
    });
  }, [cameraRef, enabled, mapReady, courseUp, followZoom, fix?.latitude, fix?.longitude, fix?.heading, fix?.cogDeg, fix?.speedKn, fix?.timestamp]);
}
