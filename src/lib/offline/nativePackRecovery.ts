import {
  OfflineManager,
  type OfflinePack,
  type OfflinePackCreateOptions,
  type OfflinePackErrorListener,
  type OfflinePackProgressListener,
} from '@maplibre/maplibre-react-native';

import { yieldToUi } from '../async/yieldToUi';
import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';
import { ensureOfflinePackStyleReachable } from '../../map/chartStyle';
import { isNativeDownloadKickstarted } from './nativePackProgress';
import { pollNativePackStatus } from './nativePackStatus';
import { getDownloadTiming } from './downloadTiming';
import { ensureOfflineMapEngineReadyForDownload, offlineEngineViewportFromBounds } from './offlineMapEngineHost';
import { warmupOfflineEngine } from './warmupOfflineEngine';

async function removeNativePack(packId: string): Promise<void> {
  try {
    await OfflineManager.deletePack(packId);
  } catch {
    /* may already be gone */
  }
}

/**
 * Delete a stuck pack and create a fresh one after the map engine is ready.
 * Used when enumeration never advances past the style-only resource count.
 *
 * @param engineStyleUri Documents/MapView style URI (file:// on Android). Must NOT be the
 *   OfflineManager HTTP loopback URL — DownloadMapEngine readiness is keyed to file://.
 */
export async function recreateOfflinePack(
  oldPack: OfflinePack,
  options: OfflinePackCreateOptions,
  onProgress: OfflinePackProgressListener,
  onError: OfflinePackErrorListener,
  isSessionActive?: () => boolean,
  engineStyleUri?: string,
): Promise<OfflinePack | null> {
  if (isSessionActive?.() === false) return null;

  ensureMapLibreNetworkForDownload();
  try {
    await oldPack.pause();
  } catch {
    /* may already be inactive */
  }
  await removeNativePack(oldPack.id);
  await yieldToUi();

  // Prime GL with the MapView style; createPack keeps options.mapStyle (loopback HTTP on Android).
  const primeStyleUri = engineStyleUri ?? options.mapStyle;
  await warmupOfflineEngine(primeStyleUri, { requireStyleLoaded: false, requireFileSource: true });
  const viewport = offlineEngineViewportFromBounds(options.bounds, options.minZoom ?? 10);
  await ensureOfflineMapEngineReadyForDownload(primeStyleUri, viewport);
  if (isSessionActive?.() === false) return null;

  // Fail fast if Android loopback style server is down (same gate as initial createPack).
  await ensureOfflinePackStyleReachable(primeStyleUri);
  if (isSessionActive?.() === false) return null;

  ensureMapLibreNetworkForDownload();
  const pack = await OfflineManager.createPack(options, onProgress, onError);
  if (!pack?.id) return null;

  try {
    await OfflineManager.addListener(pack.id, onProgress, onError);
  } catch {
    /* createPack callbacks may already be wired */
  }

  ensureMapLibreNetworkForDownload();
  try {
    await pack.resume();
  } catch {
    /* native may already be active */
  }

  const timing = getDownloadTiming();
  for (let attempt = 0; attempt < timing.recreateKickstartPolls; attempt++) {
    if (isSessionActive?.() === false) return pack;
    await new Promise((resolve) => setTimeout(resolve, timing.recreateKickstartIntervalMs));
    ensureMapLibreNetworkForDownload();
    const status = await pollNativePackStatus(pack);
    if (isNativeDownloadKickstarted(status)) return pack;
    if (attempt === 2 || attempt === 6) {
      try {
        await pack.resume();
      } catch {
        /* best effort */
      }
    }
  }

  return pack;
}
