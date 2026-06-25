import { ScrollView, StyleSheet, View } from 'react-native';

import { RACING_PACK_V11 } from '../../lib/featureFlags';
import { useIsEffectivelyOffline } from '../../lib/network/connectivity';
import { useChartCoverageAtPoint } from '../../hooks/useChartCoverageAtPoint';
import { useFormFactor } from '../../hooks/useFormFactor';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { GpsStatusStrip } from './GpsStatusStrip';
import { MapPreviewTrackBanner } from './MapPreviewTrackBanner';
import { PassageFollowBanner } from './PassageFollowBanner';
import { RaceCountdownBanner } from '../racing/RaceCountdownBanner';
import { MAP_CHROME_GAP } from './mapChromeLayout';
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
  activityProfileId: string;
  raceCountdown: { isActive: boolean; isStarted: boolean; remainingMs: number | null };
  /** Passage follow strip on the map — only when the instrument panel is hidden (minimal layout). */
  showPassageFollow?: boolean;
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
  activityProfileId,
  raceCountdown,
  showPassageFollow = false,
  onTopChromeLayout,
}: Props) {
  const { spacing, minTouch } = useTheme();
  const { formFactor, height } = useFormFactor();
  const isOffline = useIsEffectivelyOffline();
  const offlineHydrated = useOfflinePackStore((s) => s.hydrated);
  const hasReadyPack = useOfflinePackStore((s) => s.hasReadyPack());
  const downloadHintDismissed = useSettingsStore((s) => s.downloadHintDismissed);
  const coverage = useChartCoverageAtPoint(viewportLatitude, viewportLongitude);

  const showOfflineAlert = offlineHydrated && isOffline && !hasReadyPack;
  const showCoverageAlert = offlineHydrated && isOffline && hasReadyPack && !coverage.covered && coverage.readyPackCount > 0;
  const showDownloadHint = !isOffline && !hasReadyPack && !downloadHintDismissed;

  let alertKind: 'offline' | 'coverage' | 'download' | null = null;
  if (showOfflineAlert) alertKind = 'offline';
  else if (showCoverageAlert) alertKind = 'coverage';
  else if (showDownloadHint) alertKind = 'download';

  const showRaceBanner =
    RACING_PACK_V11 && activityProfileId === 'sailing-race' && (raceCountdown.isActive || raceCountdown.isStarted);

  const bannerMaxHeight = bannerStackMaxHeight(height, formFactor);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingRight: actionColumnWidth, gap: MAP_CHROME_GAP }]}
      onLayout={(e) => onTopChromeLayout?.(e.nativeEvent.layout.height)}
      testID="map.topChrome"
    >
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

      {showPassageFollow || showRaceBanner ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: bannerMaxHeight, flexGrow: 0 }}
          contentContainerStyle={{ gap: MAP_CHROME_GAP }}
        >
          {showPassageFollow ? <PassageFollowBanner compact onOpenPassage={onOpenPassage} /> : null}
          <MapPreviewTrackBanner compact />
          {showRaceBanner ? (
            <RaceCountdownBanner remainingMs={raceCountdown.remainingMs} isActive={raceCountdown.isActive} isStarted={raceCountdown.isStarted} />
          ) : null}
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
