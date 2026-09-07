import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../../i18n';
import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { DownloadProgressBar } from './DownloadProgressBar';
import {
  isPackDownloadActive,
  packStatusLabel,
  resolvePackDisplayName,
} from './packDownloadPresentation';

/**
 * Always-on-top download status chrome for every tab.
 *
 * The Android download TextureView is mounted under the navigator so it cannot
 * black out Settings/Passage/etc. This banner stays above the UI so progress and
 * cancel remain reachable even while navigation was open and the live chart yielded.
 */
export function GlobalDownloadSessionChrome() {
  const exclusive = useExclusiveChartDownloadSession();
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const cancelDownload = useOfflinePackStore((s) => s.cancelDownload);
  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
  const status = useOfflinePackStore((s) => (sessionRegionId != null ? s.regions[sessionRegionId] : undefined));
  const [cancelBusy, setCancelBusy] = useState(false);

  const handleCancel = useCallback(async () => {
    if (!sessionRegionId || cancelBusy) return;
    setCancelBusy(true);
    try {
      await cancelDownload(sessionRegionId);
      showInfo(t('downloads.downloadCancelled'));
    } finally {
      setCancelBusy(false);
    }
  }, [cancelBusy, cancelDownload, sessionRegionId, showInfo]);

  if (!exclusive || sessionRegionId == null) return null;

  const name = resolvePackDisplayName(status ?? { regionId: sessionRegionId });
  const downloading = status?.state === 'downloading';
  const percent = status?.percentage ?? 0;
  const completing = status?.state === 'ready' || (downloading && percent >= 99);
  const tearingDown =
    completing && activeDownloadRegionId == null && downloadMapTeardownRegionId === sessionRegionId;
  const initializing =
    (downloading && !completing && (status?.downloadInitializing || percent <= 0)) ||
    (activeDownloadRegionId != null && !downloading && status?.state !== 'ready' && status?.state !== 'error');
  const canCancel =
    (downloading || (activeDownloadRegionId === sessionRegionId && !completing)) &&
    !tearingDown &&
    !completing &&
    isPackDownloadActive(sessionRegionId, status ?? { state: 'idle' }, activeDownloadRegionId);

  const title = completing
    ? t('downloads.statusSummaryCompletingTitle')
    : t('downloads.statusSummaryActiveTitle');
  const body = completing
    ? t('downloads.statusSummaryCompleting', { name })
    : initializing
      ? t('downloads.statusSummaryActiveInitializing', { name })
      : t('downloads.statusSummaryActive', { name, percent: Math.round(percent) });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: Math.max(insets.top, spacing.sm) }]}
      testID="downloads.globalSessionChrome"
    >
      <View
        style={[
          styles.banner,
          {
            marginHorizontal: spacing.md,
            marginBottom: spacing.sm,
            backgroundColor: completing ? colors.primary + '12' : colors.warningBg,
            borderColor: completing ? colors.primary : colors.warningBorder,
            gap: spacing.sm,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`${title}. ${body}`}
        accessibilityLiveRegion="polite"
      >
        <Text
          style={[styles.title, { color: completing ? colors.primary : colors.warningText }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>{body}</Text>
        {downloading && !completing ? (
          <DownloadProgressBar
            percentage={percent}
            indeterminate={initializing}
            label={packStatusLabel({
              state: 'downloading',
              percentage: percent,
              error: null,
              downloadInitializing: status?.downloadInitializing || initializing,
            })}
            showLabel={false}
            testID="downloads.globalSessionChrome.progress"
          />
        ) : null}
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {completing ? t('downloads.statusSummaryCompletingHint') : t('downloads.statusSummaryActiveHint')}
        </Text>
        {canCancel ? (
          <View style={{ minHeight: minTouch }}>
            <Button
              label={t('downloads.cancelDownload')}
              variant="secondary"
              onPress={() => void handleCancel()}
              disabled={cancelBusy}
              loading={cancelBusy}
              testID="downloads.globalSessionChrome.cancel"
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    // Top-only host — never absoluteFill. Avoid elevation: it creates a hardware
    // layer that can prevent Android TextureViews (download map) from painting.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    elevation: 0,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  title: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '600', lineHeight: 22, flexShrink: 1 },
  hint: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
});
