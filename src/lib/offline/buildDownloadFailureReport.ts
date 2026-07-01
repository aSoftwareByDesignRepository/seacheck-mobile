import Constants from 'expo-constants';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { resolvePackDisplayName } from '../../features/downloads/packDownloadPresentation';
import { getRegionPack } from '../../map/regionPacks';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';

import { peekDownloadFailureDiagnostics } from './downloadFailureDiagnostics';

export type DownloadFailureSource = 'async' | 'preflight' | 'hydrate' | 'manual';

export type DownloadFailureInput = {
  regionId: string;
  message: string;
  source?: DownloadFailureSource;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

function line(key: string, value: string | number | boolean | null | undefined): string {
  return `${key}=${value ?? 'null'}`;
}

/** Structured, paste-friendly report for support / debugging (no secrets). */
export async function buildDownloadFailureReport(input: DownloadFailureInput): Promise<string> {
  const store = useOfflinePackStore.getState();
  const status = store.regions[input.regionId];
  const packDef = getRegionPack(input.regionId);
  const bounds = status?.custom ? store.customBoundsIndex[input.regionId] : packDef?.bounds;
  const net = await NetInfo.fetch();
  const settings = useSettingsStore.getState();
  const api = Platform.OS === 'android' ? Number(Platform.Version) : 0;

  const lines: string[] = [
    'SeaCheck Download Failure Report',
    '================================',
    line('time', new Date().toISOString()),
    line('app', Constants.expoConfig?.version ?? '0.0.0'),
    line('platform', Platform.OS),
    line('apiLevel', api),
    line('device', Device.modelName ?? 'unknown'),
    '',
    'Pack',
    '----',
    line('regionId', input.regionId),
    line('name', resolvePackDisplayName(status ?? { regionId: input.regionId })),
    line('custom', status?.custom ?? false),
    line('legacy', status?.legacy ?? false),
    line('state', status?.state ?? 'unknown'),
    line('percentage', status?.percentage ?? 0),
    line('packId', status?.packId),
    line('error', input.message),
    line('source', input.source ?? 'unknown'),
    line('activeDownloadRegionId', store.activeDownloadRegionId),
    line('hydrated', store.hydrated),
    line('chartStyleUri', store.chartStyleUri ? 'present' : 'missing'),
    '',
    'Bounds',
    '------',
    line('bounds', bounds ? bounds.join(',') : null),
    line('minZoom', packDef?.minZoom ?? null),
    line('maxZoom', packDef?.maxZoom ?? null),
    line('priority', packDef?.priority ?? null),
    '',
    'Network',
    '-------',
    line('isConnected', net.isConnected),
    line('isInternetReachable', net.isInternetReachable),
    line('type', net.type),
    line('downloadWifiOnly', settings.downloadWifiOnly),
  ];

  const nativeDiagnostics = peekDownloadFailureDiagnostics(input.regionId);
  if (nativeDiagnostics) {
    lines.push(
      '',
      'Native pack (at failure)',
      '------------------------',
      line('nativeState', nativeDiagnostics.nativeState),
      line('nativePercentage', nativeDiagnostics.percentage),
      line('completedResourceCount', nativeDiagnostics.completedResourceCount),
      line('requiredResourceCount', nativeDiagnostics.requiredResourceCount),
    );
  }

  if (input.extra && Object.keys(input.extra).length > 0) {
    lines.push('', 'Extra', '-----');
    for (const [key, value] of Object.entries(input.extra)) {
      lines.push(line(key, value));
    }
  }

  return lines.join('\n');
}
