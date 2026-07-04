import type { OfflinePackStatus } from '@maplibre/maplibre-react-native';

import {
  hasMeasurableDownloadProgress,
  hasPendingNativeResources,
  isNativeDownloadKickstarted,
  isNativePackInitializing,
} from '../src/lib/offline/nativePackProgress';

function status(partial: Partial<OfflinePackStatus> & Pick<OfflinePackStatus, 'state'>): OfflinePackStatus {
  return {
    id: 'pack-1',
    percentage: 0,
    completedResourceCount: 0,
    completedResourceSize: 0,
    completedTileCount: 0,
    completedTileSize: 0,
    requiredResourceCount: 0,
    ...partial,
  };
}

describe('nativePackProgress', () => {
  it('treats active 0% with one required resource as initializing', () => {
    const s = status({ state: 'active', requiredResourceCount: 1 });
    expect(hasMeasurableDownloadProgress(s)).toBe(false);
    expect(isNativePackInitializing(s)).toBe(true);
    expect(isNativeDownloadKickstarted(s)).toBe(false);
  });

  it('treats enumerated tiles as kickstarted even at 0%', () => {
    const s = status({ state: 'active', requiredResourceCount: 48, completedResourceCount: 0 });
    expect(isNativeDownloadKickstarted(s)).toBe(true);
    expect(hasPendingNativeResources(s)).toBe(true);
  });

  it('treats completed bytes as measurable progress', () => {
    const s = status({ state: 'active', requiredResourceCount: 10, completedResourceCount: 1, percentage: 10 });
    expect(hasMeasurableDownloadProgress(s)).toBe(true);
    expect(isNativePackInitializing(s)).toBe(false);
  });

  it('treats completed tile count as measurable progress', () => {
    const s = status({ state: 'active', requiredResourceCount: 10, completedTileCount: 1 });
    expect(hasMeasurableDownloadProgress(s)).toBe(true);
  });
});
