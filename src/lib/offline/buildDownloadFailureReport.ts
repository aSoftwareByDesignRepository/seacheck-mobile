import Constants from 'expo-constants';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { resolvePackDisplayName } from '../../features/downloads/packDownloadPresentation';
import { getRegionPack } from '../../map/regionPacks';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';

import { peekDownloadFailureDiagnostics, peekDownloadSessionPhase } from './downloadFailureDiagnostics';
import {
  isOfflineMapEngineStyleLoaded,
  getOfflineMapEngineStyleReloadNonce,
  isOfflineMapEngineViewportPrimed,
} from './offlineMapEngineHost';
import { isDownloadMapReady } from './downloadMapHost';
import { downloadCoordinator } from './downloadCoordinator';
import { resolveOfflineEngineCamera } from './resolveOfflineEngineCamera';
import { peekChartTileProbeDiagnostics } from '../network/chartTileReachability';

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

  const viewport = resolveOfflineEngineCamera(input.regionId, store.customBoundsIndex);
  const mapEngineStyleLoaded = store.chartStyleUri ? isOfflineMapEngineStyleLoaded(store.chartStyleUri) : false;
  const mapEngineViewportPrimed = store.chartStyleUri ? isOfflineMapEngineViewportPrimed(viewport) : false;
  const minZoom = packDef?.minZoom ?? (status?.custom ? 10 : null);
  const maxZoom = packDef?.maxZoom ?? (status?.custom ? 14 : null);

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
    line('downloadMapTeardownRegionId', store.downloadMapTeardownRegionId),
    line('exclusiveMapSession', downloadCoordinator.hasExclusiveMapSession()),
    line('sessionPhase', input.extra?.phase ?? peekDownloadSessionPhase(input.regionId)),
    line('hydrated', store.hydrated),
    line('chartStyleUri', store.chartStyleUri ? 'present' : 'missing'),
    line('mapEngineStyleLoaded', mapEngineStyleLoaded),
    line('mapEngineViewportPrimed', mapEngineViewportPrimed),
    line('downloadMapReady', isDownloadMapReady()),
    line('mapEngineReloadNonce', store.chartStyleUri ? getOfflineMapEngineStyleReloadNonce() : null),
    '',
    'Bounds',
    '------',
    line('bounds', bounds ? bounds.join(',') : null),
    line('minZoom', minZoom),
    line('maxZoom', maxZoom),
    line('priority', packDef?.priority ?? null),
    '',
    'Network',
    '-------',
    line('isConnected', net.isConnected),
    line('isInternetReachable', net.isInternetReachable),
    line('type', net.type),
    line('downloadWifiOnly', settings.downloadWifiOnly),
  ];

  const tileProbe = peekChartTileProbeDiagnostics();
  if (tileProbe) {
    lines.push(
      '',
      'Tile probe (last attempt)',
      '-------------------------',
      line('probeCenter', tileProbe.probeCenter),
      line('probeBaseUrl', tileProbe.baseUrl),
      line('probeSeamarkUrl', tileProbe.seamarkUrl),
      line('probeAttempts', tileProbe.attempts),
      line('probeLastHttpStatus', tileProbe.lastHttpStatus),
      line('probeLastError', tileProbe.lastError),
    );
  }

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
      line('mapEngineStyleLoaded', nativeDiagnostics.mapEngineStyleLoaded),
    );
  }

  if (input.extra && Object.keys(input.extra).length > 0) {
    lines.push('', 'Extra', '-----');
    for (const [key, value] of Object.entries(input.extra)) {
      if (key === 'stackTrace' && typeof value === 'string' && value.length > 0) {
        lines.push('', 'Stack trace', '-----------', value);
        continue;
      }
      lines.push(line(key, value));
    }
  }

  return lines.join('\n');
}
