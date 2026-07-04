import type { LngLatBounds } from '@maplibre/maplibre-react-native';

import { boundsCenter } from '../map/bounds';
import { getRegionPack } from '../../map/regionPacks';

export type OfflineEngineCamera = {
  center: [number, number];
  zoom: number;
};

/** Baltic fallback — matches kiel-bay test pack and hidden engine default. */
const DEFAULT_CAMERA: OfflineEngineCamera = {
  center: [10.15, 54.32],
  zoom: 10,
};

/**
 * Aim the hidden Android map at the pack being downloaded so raster sources initialize
 * in the correct viewport before OfflineManager enumerates tiles.
 */
export function resolveOfflineEngineCamera(
  activeDownloadRegionId: string | null,
  customBoundsIndex: Record<string, LngLatBounds>,
): OfflineEngineCamera {
  if (!activeDownloadRegionId) return DEFAULT_CAMERA;

  const customBounds = customBoundsIndex[activeDownloadRegionId];
  if (customBounds) {
    const center = boundsCenter(customBounds);
    return { center: [center.longitude, center.latitude], zoom: 10 };
  }

  const pack = getRegionPack(activeDownloadRegionId);
  if (!pack) return DEFAULT_CAMERA;

  const center = boundsCenter(pack.bounds);
  return { center: [center.longitude, center.latitude], zoom: pack.minZoom };
}
