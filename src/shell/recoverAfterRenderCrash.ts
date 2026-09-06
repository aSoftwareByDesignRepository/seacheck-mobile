import { cancelAllPendingConfirms } from '../store/confirmStore';
import { downloadCoordinator } from '../lib/offline/downloadCoordinator';
import { useOfflinePackStore } from '../store/offlinePackStore';

/**
 * After a render crash Retry: drain confirms and clear exclusive download locks
 * so the next session cannot sit behind a ghost coordinator / confirm sheet.
 */
export async function recoverAfterRenderCrash(): Promise<void> {
  cancelAllPendingConfirms();

  const exclusiveId =
    downloadCoordinator.getActiveRegionId() ?? downloadCoordinator.getTeardownRegionId();
  if (exclusiveId == null) {
    return;
  }

  try {
    await useOfflinePackStore.getState().cancelDownload(exclusiveId);
  } catch (error) {
    console.warn('[recoverAfterRenderCrash] cancelDownload failed — forcing invalidate', error);
    downloadCoordinator.invalidate(exclusiveId);
  }
}
