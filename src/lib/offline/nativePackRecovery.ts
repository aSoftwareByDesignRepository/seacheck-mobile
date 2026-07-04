import {
  OfflineManager,
  type OfflinePack,
  type OfflinePackCreateOptions,
  type OfflinePackErrorListener,
  type OfflinePackProgressListener,
} from '@maplibre/maplibre-react-native';

import { yieldToUi } from '../async/yieldToUi';
import { ensureMapLibreNetworkForDownload } from '../network/mapLibreNetworkGate';
import { isNativeDownloadKickstarted } from './nativePackProgress';
import { pollNativePackStatus } from './nativePackStatus';
import { getDownloadTiming } from './downloadTiming';
import { ensureOfflineMapEnginePrimedBeforeDownload } from './offlineMapEngineHost';
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
 */
export async function recreateOfflinePack(
  oldPack: OfflinePack,
  options: OfflinePackCreateOptions,
  onProgress: OfflinePackProgressListener,
  onError: OfflinePackErrorListener,
  isSessionActive?: () => boolean,
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

  await warmupOfflineEngine(options.mapStyle, { requireStyleLoaded: false, requireFileSource: true });
  await ensureOfflineMapEnginePrimedBeforeDownload(options.mapStyle);
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
