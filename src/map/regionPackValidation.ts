import { MAX_TILE_COUNT } from '../lib/map/bounds';
import { estimateDownloadKb, estimateTileCount, formatStorageSize } from './tileMath';
import type { RegionPackDefinition } from './regionPacks';

export type RegionPackValidation =
  | { ok: true; tileCount: number; estimatedKb: number; sizeLabel: string }
  | { ok: false; tileCount: number; estimatedKb: number; sizeLabel: string; limit: number };

/** Ensures predefined packs stay within the same tile budget as custom downloads. */
export function validateRegionPack(pack: RegionPackDefinition): RegionPackValidation {
  const tileCount = estimateTileCount(pack.bounds, pack.minZoom, pack.maxZoom);
  const estimatedKb = estimateDownloadKb(tileCount);
  const sizeLabel = formatStorageSize(estimatedKb);
  if (tileCount > MAX_TILE_COUNT) {
    return { ok: false, tileCount, estimatedKb, sizeLabel, limit: MAX_TILE_COUNT };
  }
  return { ok: true, tileCount, estimatedKb, sizeLabel };
}

/** Wi‑Fi recommended above ~100 MB (NV Charts shows size; we nudge before large pulls). */
export const LARGE_PACK_KB_THRESHOLD = 100 * 1024;

export function isLargeRegionPack(pack: RegionPackDefinition): boolean {
  return validateRegionPack(pack).estimatedKb >= LARGE_PACK_KB_THRESHOLD;
}
