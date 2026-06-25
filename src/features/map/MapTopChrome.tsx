import { ScrollView, StyleSheet, View } from 'react-native';

import { RACING_PACK_V11 } from '../../lib/featureFlags';
import { useIsEffectivelyOffline } from '../../lib/network/connectivity';
import { useChartCoverageAtPoint } from '../../hooks/useChartCoverageAtPoint';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { GpsStatusStrip } from './GpsStatusStrip';
import { MapPreviewTrackBanner } from './MapPreviewTrackBanner';
import { RaceCountdownBanner } from '../racing/RaceCountdownBanner';
import { MAP_CHROME_GAP } from './mapChromeLayout';
import { MapTopAlertBanner } from './MapTopAlertBanner';

type Props = {
  actionColumnWidth: number;
  onOpenDownloads: () => void;
  onOpenSettings: () => void;
  showRecenter: boolean;
  onRecenter: () => void;
  viewportLatitude: number;
  viewportLongitude: number;
  activityProfileId: string;
  raceCountdown: { isActive: boolean; isStarted: boolean; remainingMs: number | null };
  onTopChromeLayout?: (height: number) => void;
};

/**
 * Top map chrome — one advisory banner max, scrollable status chips, clear right margin for action buttons.
 */
export function MapTopChrome({
  actionColumnWidth,
  onOpenDownloads,
  onOpenSettings,
  showRecenter,
  onRecenter,
  viewportLatitude,
  viewportLongitude,
  activityProfileId,
  raceCountdown,
  onTopChromeLayout,
}: Props) {
  const { spacing, minTouch } = useTheme();
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
        contentContainerStyle={[styles.statusScroll, { gap: spacing.sm }]}
        style={[styles.statusScrollHost, { maxHeight: minTouch + 72 }]}
      >
        <GpsStatusStrip
          onOpenSettings={onOpenSettings}
          showRecenter={showRecenter}
          onRecenter={onRecenter}
          compact
        />
      </ScrollView>

      <MapPreviewTrackBanner compact />

      {RACING_PACK_V11 && activityProfileId === 'sailing-race' && (raceCountdown.isActive || raceCountdown.isStarted) ? (
        <RaceCountdownBanner remainingMs={raceCountdown.remainingMs} isActive={raceCountdown.isActive} isStarted={raceCountdown.isStarted} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%', zIndex: 20 },
  statusScrollHost: { flexGrow: 0 },
  statusScroll: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
});
