import { ScrollView, StyleSheet, View } from 'react-native';

import { useIsEffectivelyOffline } from '../../lib/network/connectivity';
import { useChartCoverageAtPoint } from '../../hooks/useChartCoverageAtPoint';
import { selectHasReadyOfflinePack } from '../../lib/map/chartRasterVisibility';
import { useFormFactor } from '../../hooks/useFormFactor';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { GpsStatusStrip } from './GpsStatusStrip';
import { MapPreviewTrackBanner } from './MapPreviewTrackBanner';
import { PassageFollowBanner } from './PassageFollowBanner';
import { MAP_CHROME_GAP } from './mapChromeLayout';
import { MapModeHintStrip } from './MapModeHintStrip';
import { MapTopAlertBanner } from './MapTopAlertBanner';

type Props = {
  actionColumnWidth: number;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
  onOpenPassage: () => void;
  showRecenter: boolean;
  onRecenter: () => void;
  viewportLatitude: number;
  viewportLongitude: number;
  /** Passage follow strip on the map — only when the instrument panel is hidden (minimal layout). */
  showPassageFollow?: boolean;
  /** Mode hint (planning, etc.) — shown above alerts; reserves action column like other chrome. */
  modeHint?: string | null;
  onTopChromeLayout?: (height: number) => void;
};

/** Max height for stacked map banners — avoids covering the chart on phones and tablets. */
function bannerStackMaxHeight(screenHeight: number, formFactor: 'compact' | 'medium' | 'expanded'): number {
  const ratio = formFactor === 'expanded' ? 0.26 : formFactor === 'medium' ? 0.24 : 0.22;
  const cap = formFactor === 'expanded' ? 260 : formFactor === 'medium' ? 220 : 200;
  return Math.min(cap, Math.round(screenHeight * ratio));
}

/**
 * Top map chrome — one advisory banner max, scrollable status chips, clear right margin for action buttons.
 */
export function MapTopChrome({
  actionColumnWidth,
  onOpenDownloads,
  onOpenSettings,
  onOpenPassage,
  showRecenter,
  onRecenter,
  viewportLatitude,
  viewportLongitude,
  showPassageFollow = false,
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

  const bannerMaxHeight = bannerStackMaxHeight(height, formFactor);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingRight: actionColumnWidth, gap: MAP_CHROME_GAP }]}
      onLayout={(e) => onTopChromeLayout?.(e.nativeEvent.layout.height)}
      testID="map.topChrome"
    >
      {modeHint ? <MapModeHintStrip message={modeHint} testID="map.modeHint" /> : null}
      {alertKind ? (
        <MapTopAlertBanner kind={alertKind} onOpenDownloads={onOpenDownloads} onDismissDownloadHint={() => void useSettingsStore.getState().dismissDownloadHint()} />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.statusScroll, { gap: spacing.sm, paddingVertical: spacing.xs, minHeight: minTouch }]}
        style={styles.statusScrollHost}
      >
        <GpsStatusStrip
          onOpenSettings={onOpenSettings}
          showRecenter={showRecenter}
          onRecenter={onRecenter}
          compact
        />
      </ScrollView>

      {showPassageFollow ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: bannerMaxHeight, flexGrow: 0 }}
          contentContainerStyle={{ gap: MAP_CHROME_GAP }}
        >
          <PassageFollowBanner compact onOpenPassage={onOpenPassage} />
          <MapPreviewTrackBanner compact />
        </ScrollView>
      ) : (
        <MapPreviewTrackBanner compact />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%', zIndex: 20 },
  statusScrollHost: { flexGrow: 0, flexShrink: 0 },
  statusScroll: { flexDirection: 'row', alignItems: 'center' },
});
