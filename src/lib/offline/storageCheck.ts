import * as FileSystem from 'expo-file-system/legacy';

/** Headroom beyond the tile estimate so the OS and app data are not starved. */
const MIN_FREE_BUFFER_BYTES = 50 * 1024 * 1024;
const SIZE_MARGIN = 1.25;

export type StorageCheckResult =
  | { ok: true }
  | { ok: false; reason: 'insufficient' | 'unavailable' };

/** Best-effort free-space guard before large offline chart downloads. */
export async function ensureStorageForDownload(estimatedKb: number): Promise<StorageCheckResult> {
  // Invalid / missing estimate → fail closed (do not skip the disk check).
  if (!Number.isFinite(estimatedKb) || estimatedKb <= 0) {
    return { ok: false, reason: 'unavailable' };
  }

  try {
    if (!FileSystem.getFreeDiskStorageAsync) {
      return { ok: false, reason: 'unavailable' };
    }
    const freeBytes = await FileSystem.getFreeDiskStorageAsync();
    if (!Number.isFinite(freeBytes) || freeBytes < 0) {
      return { ok: false, reason: 'unavailable' };
    }
    const neededBytes = estimatedKb * 1024 * SIZE_MARGIN;
    if (freeBytes < neededBytes + MIN_FREE_BUFFER_BYTES) {
      return { ok: false, reason: 'insufficient' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
