import type { OfflinePackStatus } from '@maplibre/maplibre-react-native';

/** Bytes or percentage moved — not merely queued or marked active. */
export function hasMeasurableDownloadProgress(status: OfflinePackStatus): boolean {
  return status.percentage > 0 || status.completedResourceCount > 0;
}

/** Native registered resources still to fetch (includes style + tiles). */
export function hasPendingNativeResources(status: OfflinePackStatus): boolean {
  return status.requiredResourceCount > 0 && status.completedResourceCount < status.requiredResourceCount;
}

/**
 * MapLibre often reports state=active with requiredResourceCount=1 before tile enumeration finishes.
 * Treat that as initialization, not a healthy in-flight download.
 */
export function isNativePackInitializing(status: OfflinePackStatus): boolean {
  if (hasMeasurableDownloadProgress(status)) return false;
  if (status.requiredResourceCount > 1) return false;
  return status.state === 'active' || status.state === 'inactive' || status.requiredResourceCount <= 1;
}

/** Kickstart may return once enumeration started or bytes are moving. */
export function isNativeDownloadKickstarted(status: OfflinePackStatus): boolean {
  if (hasMeasurableDownloadProgress(status)) return true;
  if (status.requiredResourceCount > 1 && hasPendingNativeResources(status)) return true;
  return false;
}
