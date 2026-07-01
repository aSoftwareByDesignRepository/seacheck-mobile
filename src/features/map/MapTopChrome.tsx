import { ScrollView, StyleSheet, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useIsEffectivelyOffline } from '../../lib/network/connectivity';
import { useChartCoverageAtPoint } from '../../hooks/useChartCoverageAtPoint';
import { selectHasReadyOfflinePack } from '../../lib/map/chartRasterVisibility';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { GpsStatusStrip } from './GpsStatusStrip';
import { MapChipScrollRow } from './MapChipScrollRow';
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
function topChromeMaxHeight(screenHeight: number, formFactor: 'compact' | 'medium' | 'expanded'): number {
  const ratio = formFactor === 'expanded' ? 0.44 : formFactor === 'medium' ? 0.42 : 0.4;
  const cap = formFactor === 'expanded' ? 360 : formFactor === 'medium' ? 320 : 280;
  return Math.min(cap, Math.round(screenHeight * ratio));
}

/**
 * Top map chrome — scrollable when stacked; GPS chips scroll horizontally without clipping.
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
  const { formFactor, height } = useFormFactor();
  const isOffline = useIsEffectivelyOffline();
  const offlineHydrated = useOfflinePackStore((s) => s.hydrated);
  const offlineRegions = useOfflinePackStore((s) => s.regions);
  const hasReadyPack = selectHasReadyOfflinePack(offlineRegions);
  const downloadHintDismissed = useSettingsStore((s) => s.downloadHintDismissed);
  const coverage = useChartCoverageAtPoint(viewportLatitude, viewportLongitude);

  const showOfflineAlert = offlineHydrated && isOffline && !hasReadyPack;
  const showCoverageAlert = offlineHydrated && isOffline && hasReadyPack && !coverage.covered && coverage.readyPackCount > 0;
  const showDownloadHint = !isOffline && !hasReadyPack && !downloadHintDismissed;

  let alertKind: 'offline' | 'coverage' | 'download' | null = null;
  if (showOfflineAlert) alertKind = 'offline';
  else if (showCoverageAlert) alertKind = 'coverage';
  else if (showDownloadHint) alertKind = 'download';

  const chromeMaxHeight = topChromeMaxHeight(height, formFactor);
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
            onDismissDownloadHint={() => void useSettingsStore.getState().dismissDownloadHint()}
          />
        ) : null}

        <MapChipScrollRow minHeight={chipStripMinHeight} reserveRight={0} testID="map.statusChips">
          <GpsStatusStrip
            onOpenSettings={onOpenSettings}
            showRecenter={showRecenter}
            onRecenter={onRecenter}
            compact
          />
          <MapRecordingChip onOpenTracks={onOpenTracks} />
        </MapChipScrollRow>

        <MapPreviewTrackBanner compact />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%' },
  content: { width: '100%' },
});
