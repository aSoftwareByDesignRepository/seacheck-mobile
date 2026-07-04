import type { OfflinePack, OfflinePackStatus } from '@maplibre/maplibre-react-native';

import { promiseWithTimeout } from '../async/promiseWithTimeout';

const NATIVE_STATUS_TIMEOUT_MS = 4_000;

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nativeState(value: unknown): OfflinePackStatus['state'] {
  if (value === 'active' || value === 'inactive' || value === 'complete') return value;
  return 'inactive';
}

/** Synthetic status while native enumeration has not returned a payload yet. */
export function initializingNativePackStatus(packId: string): OfflinePackStatus {
  return {
    id: packId,
    state: 'inactive',
    percentage: 0,
    completedResourceCount: 0,
    completedResourceSize: 0,
    completedTileCount: 0,
    completedTileSize: 0,
    requiredResourceCount: 0,
  };
}

/**
 * Normalize native bridge payloads. Some Android builds return null/empty objects
 * before tile enumeration finishes — never read `.state` on unchecked values.
 */
export function normalizeNativePackStatus(raw: unknown, packId?: string): OfflinePackStatus | null {
  if (raw == null || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' && row.id.trim() ? row.id : packId?.trim();
  if (!id) return null;
  return {
    id,
    state: nativeState(row.state),
    percentage: finiteNumber(row.percentage),
    completedResourceCount: finiteNumber(row.completedResourceCount),
    completedResourceSize: finiteNumber(row.completedResourceSize),
    completedTileCount: finiteNumber(row.completedTileCount),
    completedTileSize: finiteNumber(row.completedTileSize),
    requiredResourceCount: finiteNumber(row.requiredResourceCount),
  };
}

export async function pollNativePackStatus(
  pack: OfflinePack,
  timeoutMs = NATIVE_STATUS_TIMEOUT_MS,
): Promise<OfflinePackStatus | null> {
  try {
    const raw = await promiseWithTimeout(pack.status(), timeoutMs, `OfflinePack.status(${pack.id})`);
    return normalizeNativePackStatus(raw, pack.id);
  } catch (error) {
    console.warn('[nativePackStatus] native pack status poll failed', pack.id, error);
    return null;
  }
}

/** Resolve null/empty native payloads to a safe initializing status for UI + stall logic. */
export function resolveNativePackStatus(
  raw: unknown,
  packId: string,
): OfflinePackStatus {
  return normalizeNativePackStatus(raw, packId) ?? initializingNativePackStatus(packId);
}

export async function readNativePackStatus(
  pack: OfflinePack,
  timeoutMs = NATIVE_STATUS_TIMEOUT_MS,
): Promise<OfflinePackStatus | null> {
  try {
    const raw = await promiseWithTimeout(pack.status(), timeoutMs, `OfflinePack.status(${pack.id})`);
    return normalizeNativePackStatus(raw, pack.id);
  } catch (error) {
    console.warn('[nativePackStatus] native pack status unavailable', pack.id, error);
    return null;
  }
}
