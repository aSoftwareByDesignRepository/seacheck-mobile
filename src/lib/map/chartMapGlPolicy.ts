import { Platform } from 'react-native';

import { isMapScreenFocused } from './mapScreenFocus';
import { hasActiveEmbeddedChartMap } from './embeddedChartMapRegistry';
import { downloadCoordinator } from '../offline/downloadCoordinator';
import { isDownloadMapSessionActive } from '../../features/downloads/packDownloadPresentation';
import type { RegionPackStatus } from '../../store/offlinePackStore';

/**
 * Android allows only one primary MapLibre GL surface for reliable raster tiles.
 * NavigationMap owns the GL context while the Map tab is focused; the hidden offline
 * engine, download map, and embedded previews cover other tabs / download sessions.
 */
export function shouldMountNavigationChartMap(): boolean {
  if (Platform.OS !== 'android') return true;
  if (!isMapScreenFocused()) return false;
  if (downloadCoordinator.hasActiveDownload()) return false;
  if (downloadCoordinator.getTeardownRegionId() != null) return false;
  return true;
}

export function shouldMountOfflineMapEngineHost(): boolean {
  if (Platform.OS !== 'android') return false;
  if (isMapScreenFocused()) return false;
  if (downloadCoordinator.hasActiveDownload()) return false;
  if (downloadCoordinator.getTeardownRegionId() != null) return false;
  if (hasActiveEmbeddedChartMap()) return false;
  return true;
}

/** Embedded previews (Downloads / Passage) must not compete with the main chart or download map. */
export function shouldMountEmbeddedChartMap(): boolean {
  if (Platform.OS !== 'android') return true;
  if (isMapScreenFocused()) return false;
  if (downloadCoordinator.hasActiveDownload()) return false;
  if (downloadCoordinator.getTeardownRegionId() != null) return false;
  return true;
}

/**
 * Fullscreen download map during post-download GL teardown must not overlay NavigationMap
 * when the user returns to the Map tab — that leaves vectors on a blank raster surface.
 */
export function shouldMountDownloadMapSession(
  regionId: string,
  status: Pick<RegionPackStatus, 'state'> | undefined,
  activeDownloadRegionId: string | null,
  downloadMapTeardownRegionId: string | null,
): boolean {
  if (
    !isDownloadMapSessionActive(regionId, status, activeDownloadRegionId, downloadMapTeardownRegionId)
  ) {
    return false;
  }
  const teardownOnly =
    activeDownloadRegionId == null && downloadMapTeardownRegionId === regionId;
  if (teardownOnly && isMapScreenFocused()) return false;
  return true;
}
