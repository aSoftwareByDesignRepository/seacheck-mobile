import type { LonLatPoint } from '../map/bounds';
import { boundsCenter } from '../map/bounds';
import { getRegionPack } from '../../map/regionPacks';
import type { LngLatBounds } from '@maplibre/maplibre-react-native';

/** Tile probe location for a region or custom download area. */
export function resolveChartTileProbeCenter(
  regionId?: string,
  customBoundsIndex?: Record<string, LngLatBounds>,
): LonLatPoint | undefined {
  if (!regionId) return undefined;
  const pack = getRegionPack(regionId);
  if (pack) return boundsCenter(pack.bounds);
  const customBounds = customBoundsIndex?.[regionId];
  if (customBounds) return boundsCenter(customBounds);
  return undefined;
}
