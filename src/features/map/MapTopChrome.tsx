import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useIsDeviceDisconnected } from '../../lib/network/connectivity';
import { useChartCoverageAtPoint } from '../../hooks/useChartCoverageAtPoint';
import { resolveChartMapAlert, selectHasReadyOfflinePack } from '../../lib/map/chartRasterVisibility';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { GpsStatusStrip } from './GpsStatusStrip';
import { MapStatusChipRow } from './MapStatusChipRow';
import { MapPreviewTrackBanner } from './MapPreviewTrackBanner';
import { MapRecordingChip } from './MapRecordingChip';
import { MAP_CHROME_GAP } from './mapChromeLayout';
import { MapModeHintStrip } from './MapModeHintStrip';
import { MapTopAlertBanner } from './MapTopAlertBanner';

type Props = {
  actionColumnWidth: number;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
  onOpenTracks: () => void;
  showRecenter: boolean;
  onRecenter: () => void;
  viewportLatitude: number;
  viewportLongitude: number;
  /** Mode hint (planning, etc.) — shown above alerts; reserves action column like other chrome. */
  modeHint?: string | null;
  onTopChromeLayout?: (height: number) => void;
};

/** Max height for the whole top chrome stack — scrolls when hints, alerts, and banners pile up. */
function topChromeMaxHeight(screenHeight: number, formFactor: 'compact' | 'medium' | 'expanded', isLandscape: boolean): number {
  if (isLandscape) {
    const ratio = formFactor === 'expanded' ? 0.28 : formFactor === 'medium' ? 0.3 : 0.32;
    const cap = formFactor === 'expanded' ? 200 : formFactor === 'medium' ? 180 : 160;
    return Math.min(cap, Math.round(screenHeight * ratio));
  }
  const ratio = formFactor === 'expanded' ? 0.44 : formFactor === 'medium' ? 0.42 : 0.4;
  const cap = formFactor === 'expanded' ? 360 : formFactor === 'medium' ? 320 : 280;
  return Math.min(cap, Math.round(screenHeight * ratio));
}

/**
 * Top map chrome — scrollable when stacked; status chips wrap instead of clipping.
 */
export function MapTopChrome({
  actionColumnWidth,
  onOpenDownloads,
  onOpenSettings,
  onOpenTracks,
  showRecenter,
  onRecenter,
  viewportLatitude,
  viewportLongitude,
  modeHint,
  onTopChromeLayout,
}: Props) {
  const { spacing, minTouch } = useTheme();
  const { formFactor, height, isLandscape } = useFormFactor();
  const isOffline = useIsDeviceDisconnected();
  const offlineHydrated = useOfflinePackStore((s) => s.hydrated);
  const offlineRegions = useOfflinePackStore((s) => s.regions);
  const hasReadyPack = selectHasReadyOfflinePack(offlineRegions);
  const downloadHintDismissed = useSettingsStore((s) => s.downloadHintDismissed);
  const coverage = useChartCoverageAtPoint(viewportLatitude, viewportLongitude);
  const [offlineChartAlertDismissed, setOfflineChartAlertDismissed] = useState(false);

  useEffect(() => {
    if (!isOffline) setOfflineChartAlertDismissed(false);
  }, [isOffline]);

  const alertKind = resolveChartMapAlert({
    offlineHydrated,
    isOffline,
    hasReadyPack,
    chartCovered: coverage.covered,
    downloadHintDismissed,
    offlineChartAlertDismissed,
  });

  const chromeMaxHeight = topChromeMaxHeight(height, formFactor, isLandscape);
  const chipStripMinHeight = minTouch + spacing.xs * 2 + 4;

  return (
    <ScrollView
      style={{ maxHeight: chromeMaxHeight, flexGrow: 0, width: '100%' }}
      contentContainerStyle={styles.host}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={(_w, h) => onTopChromeLayout?.(h)}
      testID="map.topChrome"
    >
      <View style={[styles.content, { paddingRight: actionColumnWidth, gap: MAP_CHROME_GAP }]}>
        {modeHint ? <MapModeHintStrip message={modeHint} testID="map.modeHint" /> : null}
        {alertKind ? (
          <MapTopAlertBanner
            kind={alertKind}
            onOpenDownloads={onOpenDownloads}
            onDismiss={() => {
              if (alertKind === 'download') {
                void useSettingsStore.getState().dismissDownloadHint();
                return;
              }
              setOfflineChartAlertDismissed(true);
            }}
          />
        ) : null}

        <MapStatusChipRow minHeight={chipStripMinHeight} testID="map.statusChips">
          <GpsStatusStrip
            onOpenSettings={onOpenSettings}
            showRecenter={showRecenter}
            onRecenter={onRecenter}
            inline
          />
          <MapRecordingChip onOpenTracks={onOpenTracks} />
        </MapStatusChipRow>

        <MapPreviewTrackBanner compact />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%' },
  content: { width: '100%' },
});
