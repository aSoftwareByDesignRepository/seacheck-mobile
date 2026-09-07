import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../../i18n';
import { MAP_CHART_WATER_BG } from '../../lib/map/mapChartColors';
import {
  resolveDownloadMapSlot,
  setDownloadMapMapClaim,
  subscribeDownloadMapSlot,
} from '../../lib/offline/downloadMapSlot';
import { useExclusiveChartDownloadSession } from '../../hooks/useExclusiveChartDownloadSession';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { DownloadMapEngine } from './DownloadMapEngine';
import { DownloadProgressBar } from './DownloadProgressBar';
import {
  isPackDownloadActive,
  packStatusLabel,
  resolvePackDisplayName,
} from './packDownloadPresentation';

type Props = {
  onOpenDownloads: () => void;
  testID?: string;
};

/**
 * Visible Map-tab host for the exclusive download GL surface.
 * Chrome sits ABOVE the map (never as an absolute overlay) so Android TextureViews
 * still paint, and the status card is never clipped by the instrument dock / tab bar.
 */
export function VisibleDownloadMapPane({ onOpenDownloads, testID = 'map.downloadSession' }: Props) {
  const exclusive = useExclusiveChartDownloadSession();
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const cancelDownload = useOfflinePackStore((s) => s.cancelDownload);
  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
  const status = useOfflinePackStore((s) => (sessionRegionId != null ? s.regions[sessionRegionId] : undefined));
  const slot = useSyncExternalStore(subscribeDownloadMapSlot, resolveDownloadMapSlot, resolveDownloadMapSlot);
  const [cancelBusy, setCancelBusy] = useState(false);

  useEffect(() => {
    if (!exclusive) {
      setDownloadMapMapClaim(false);
      return;
    }
    setDownloadMapMapClaim(true);
    return () => setDownloadMapMapClaim(false);
  }, [exclusive]);

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

  const name = resolvePackDisplayName(status ?? { regionId: sessionRegionId ?? 'pack' });
  const downloading = status?.state === 'downloading';
  const percent = status?.percentage ?? 0;
  const completing = status?.state === 'ready' || (downloading && percent >= 99);
  const tearingDown =
    completing && activeDownloadRegionId == null && downloadMapTeardownRegionId === sessionRegionId;
  const cancelTeardown =
    !downloading &&
    !completing &&
    activeDownloadRegionId == null &&
    downloadMapTeardownRegionId === sessionRegionId;
  const initializing =
    (downloading && !completing && (status?.downloadInitializing || percent <= 0)) ||
    (activeDownloadRegionId != null && !downloading && status?.state !== 'ready' && status?.state !== 'error');
  const active =
    sessionRegionId != null &&
    isPackDownloadActive(sessionRegionId, status ?? { state: 'idle' }, activeDownloadRegionId);
  const canCancel =
    sessionRegionId != null &&
    (downloading || (activeDownloadRegionId === sessionRegionId && !completing)) &&
    !tearingDown &&
    !completing &&
    !cancelTeardown &&
    isPackDownloadActive(sessionRegionId, status ?? { state: 'idle' }, activeDownloadRegionId);
  const mountEngine = slot === 'map';

  const title = cancelTeardown
    ? t('downloads.downloadCancelled')
    : completing
      ? t('downloads.statusSummaryCompletingTitle')
      : t('downloads.statusSummaryActiveTitle');
  const body = cancelTeardown
    ? t('downloads.statusSummaryCancelTeardown', { name })
    : completing
      ? t('downloads.statusSummaryCompleting', { name })
      : initializing
        ? t('downloads.statusSummaryActiveInitializing', { name })
        : t('downloads.statusSummaryActive', { name, percent: Math.round(percent) });
  const hint = completing
    ? t('downloads.statusSummaryCompletingHint')
    : t('downloads.mapSessionHint');
  const a11yLabel = `${title}. ${body}. ${cancelTeardown ? '' : hint}`;
  const progressLabel = packStatusLabel({
    state: 'downloading',
    percentage: percent,
    error: null,
    downloadInitializing: status?.downloadInitializing || initializing,
  });

  return (
    <View style={styles.root} testID={testID}>
      <View
        style={[
          styles.chrome,
          {
            paddingTop: Math.max(insets.top, spacing.sm),
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={a11yLabel}
        accessibilityLiveRegion="polite"
      >
        <ScrollView
          style={styles.chromeScroll}
          contentContainerStyle={styles.chromeScrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          bounces={false}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor:
                  completing || cancelTeardown ? colors.primary + '12' : colors.warningBg,
                borderColor: completing || cancelTeardown ? colors.primary : colors.warningBorder,
                gap: spacing.sm,
              },
            ]}
          >
            <Text
              style={[
                styles.title,
                { color: completing || cancelTeardown ? colors.primary : colors.warningText },
              ]}
              accessibilityRole="header"
            >
              {title}
            </Text>
            <Text style={[styles.body, { color: colors.text }]}>{body}</Text>
            {active && !completing && !cancelTeardown ? (
              <DownloadProgressBar
                percentage={percent}
                indeterminate={initializing}
                label={progressLabel}
                showLabel={false}
                testID={`${testID}.progress`}
              />
            ) : null}
            {!cancelTeardown ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
            ) : null}
            <View style={styles.actions}>
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
              <View style={{ minHeight: minTouch }}>
                <Button
                  label={t('map.openDownloads')}
                  onPress={onOpenDownloads}
                  accessibilityHint={t('downloads.mapSessionOpenHint')}
                  testID={`${testID}.openDownloads`}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
      <View style={styles.mapSlot} collapsable={false}>
        {mountEngine ? <DownloadMapEngine layout="fill" testID={`${testID}.map`} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MAP_CHART_WATER_BG,
  },
  chrome: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    // Cap so the GL map always keeps a usable paint surface (rule: tiles must render).
    maxHeight: '42%',
    zIndex: 1,
    elevation: 0,
  },
  chromeScroll: {
    flexGrow: 0,
  },
  chromeScrollContent: {
    flexGrow: 0,
  },
  // Dedicated non-overlapped slot — Android TextureViews do not paint under elevated overlays.
  mapSlot: {
    flex: 1,
    minHeight: 180,
    width: '100%',
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 22, textAlign: 'center' },
  body: { fontSize: 15, fontWeight: '600', lineHeight: 22, textAlign: 'center', flexShrink: 1 },
  hint: { fontSize: 13, lineHeight: 18, textAlign: 'center', flexShrink: 1 },
  actions: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'stretch',
  },
});
