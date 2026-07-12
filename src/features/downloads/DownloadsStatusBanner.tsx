import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { reportDownloadFailureFromRegion } from '../../lib/offline/reportDownloadFailure';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { DownloadProgressBar } from './DownloadProgressBar';
import { DownloadMapEngine } from './DownloadMapEngine';
import {
  countReadyPacks,
  isDownloadMapSessionActive,
  isPackDownloadActive,
  listFailedPacks,
  packStatusLabel,
  resolvePackDisplayName,
} from './packDownloadPresentation';

type Props = {
  regions: Record<string, RegionPackStatus>;
  activeDownloadRegionId: string | null;
  downloadMapTeardownRegionId: string | null;
  hydrated: boolean;
  onCancelActive?: () => void;
  cancelBusy?: boolean;
  onRetryFailed?: (regionId: string) => void;
  retryBusyId?: string | null;
};

export function DownloadsStatusBanner({
  regions,
  activeDownloadRegionId,
  downloadMapTeardownRegionId,
  hydrated,
  onCancelActive,
  cancelBusy = false,
  onRetryFailed,
  retryBusyId = null,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();

  if (!hydrated) return null;

  const failedPacks = listFailedPacks(regions);
  const readyCount = countReadyPacks(regions);
  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;

  return (
    <View style={{ gap: spacing.md, marginBottom: spacing.lg }} testID="downloads.statusBanners">
      {sessionRegionId ? (
        <ActiveDownloadBanner
          regions={regions}
          sessionRegionId={sessionRegionId}
          activeDownloadRegionId={activeDownloadRegionId}
          downloadMapTeardownRegionId={downloadMapTeardownRegionId}
          onCancelActive={onCancelActive}
          cancelBusy={cancelBusy}
          colors={colors}
          spacing={spacing}
          minTouch={minTouch}
        />
      ) : null}

      {failedPacks.length > 0 ? (
        <FailedDownloadsBanner
          failedPacks={failedPacks}
          colors={colors}
          onRetry={onRetryFailed}
          retryBusyId={retryBusyId}
        />
      ) : null}

      {!sessionRegionId && failedPacks.length === 0 ? (
        readyCount > 0 ? (
          <ReadyBanner readyCount={readyCount} colors={colors} />
        ) : (
          <EmptyBanner colors={colors} />
        )
      ) : null}
    </View>
  );
}

function ActiveDownloadBanner({
  regions,
  sessionRegionId,
  activeDownloadRegionId,
  downloadMapTeardownRegionId,
  onCancelActive,
  cancelBusy,
  colors,
  spacing,
  minTouch,
}: {
  regions: Record<string, RegionPackStatus>;
  sessionRegionId: string;
  activeDownloadRegionId: string | null;
  downloadMapTeardownRegionId: string | null;
  onCancelActive?: () => void;
  cancelBusy: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  minTouch: number;
}) {
  const active = regions[sessionRegionId];
  const name = resolvePackDisplayName(active ?? { regionId: sessionRegionId });
  const downloading = active?.state === 'downloading';
  const completing = active?.state === 'ready';
  const tearingDown = completing && activeDownloadRegionId == null && downloadMapTeardownRegionId === sessionRegionId;
  const mapVisible = isDownloadMapSessionActive(
    sessionRegionId,
    active,
    activeDownloadRegionId,
    downloadMapTeardownRegionId,
  );
  const percent = active?.percentage ?? 0;
  const initializing = downloading && (active?.downloadInitializing || percent <= 0);
  const summaryLabel = completing
    ? t('downloads.statusSummaryCompleting', { name })
    : initializing
      ? t('downloads.statusSummaryActiveInitializing', { name })
      : t('downloads.statusSummaryActive', { name, percent: Math.round(percent) });
  const bannerColors = completing
    ? { backgroundColor: colors.successBg, borderColor: colors.success }
    : { backgroundColor: colors.warningBg, borderColor: colors.warningBorder };
  const titleColor = completing ? colors.success : colors.warningText;

  return (
    <View
      style={[styles.banner, bannerColors]}
      testID={completing ? 'downloads.statusBanner.completing' : 'downloads.statusBanner.active'}
      accessibilityRole="summary"
      accessibilityLabel={summaryLabel}
    >
      <Text style={[styles.title, { color: titleColor }]} accessibilityRole="header">
        {completing ? t('downloads.statusSummaryCompletingTitle') : t('downloads.statusSummaryActiveTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>{name}</Text>
      {mapVisible ? <DownloadMapEngine /> : null}
      {downloading ? (
        <DownloadProgressBar
          percentage={percent}
          indeterminate={initializing}
          label={packStatusLabel({
            state: 'downloading',
            percentage: percent,
            error: null,
            downloadInitializing: active?.downloadInitializing,
          })}
          testID="downloads.statusBanner.progress"
        />
      ) : null}
      {completing ? (
        <Text style={[styles.hint, { color: colors.text }]} accessibilityLiveRegion="polite">
          {t('downloads.statusCompleting')}
        </Text>
      ) : null}
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {completing ? t('downloads.statusSummaryCompletingHint') : t('downloads.statusSummaryActiveHint')}
      </Text>
      {downloading && onCancelActive && !tearingDown ? (
        <View style={{ minHeight: minTouch, marginTop: spacing.xs }}>
          <Button
            label={t('downloads.cancelDownload')}
            variant="secondary"
            onPress={onCancelActive}
            disabled={cancelBusy}
            loading={cancelBusy}
            testID="downloads.statusBanner.cancel"
          />
        </View>
      ) : null}
    </View>
  );
}

function FailedDownloadsBanner({
  failedPacks,
  colors,
  onRetry,
  retryBusyId = null,
}: {
  failedPacks: ReturnType<typeof listFailedPacks>;
  colors: ReturnType<typeof useTheme>['colors'];
  onRetry?: (regionId: string) => void;
  retryBusyId?: string | null;
}) {
  const failureTitle =
    failedPacks.length === 1
      ? t('downloads.statusSummaryFailedTitleOne')
      : t('downloads.statusSummaryFailedTitleMany', { count: failedPacks.length });

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}
      testID="downloads.statusBanner.failed"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={failureTitle}
    >
      <Text style={[styles.title, { color: colors.danger }]} accessibilityRole="header">
        {failureTitle}
      </Text>
      <Text style={[styles.hint, { color: colors.text }]}>{t('downloads.statusSummaryFailedHint')}</Text>
      {failedPacks.map((pack) => (
        <View
          key={pack.regionId}
          style={[styles.failureItem, { borderColor: colors.dangerBorder }]}
          testID={`downloads.statusBanner.failed.${pack.regionId}`}
        >
          <Text style={[styles.body, { color: colors.text }]}>{pack.name}</Text>
          <Text style={[styles.failureDetail, { color: colors.danger }]}>{pack.error}</Text>
          <View style={styles.failureActions}>
            {onRetry ? (
              <Button
                label={t('downloads.retryDownload')}
                variant="primary"
                onPress={() => onRetry(pack.regionId)}
                disabled={retryBusyId != null}
                loading={retryBusyId === pack.regionId}
                testID={`downloads.statusBanner.retry.${pack.regionId}`}
              />
            ) : null}
            <Button
              label={t('downloads.failureModal.viewReport')}
              variant="secondary"
              onPress={() => reportDownloadFailureFromRegion(pack.regionId)}
              testID={`downloads.statusBanner.report.${pack.regionId}`}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function ReadyBanner({
  readyCount,
  colors,
}: {
  readyCount: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.successBg, borderColor: colors.success }]}
      testID="downloads.statusBanner.ready"
      accessibilityRole="summary"
      accessibilityLabel={t('downloads.statusSummaryReady', { count: readyCount })}
    >
      <Text style={[styles.title, { color: colors.success }]} accessibilityRole="header">
        {t('downloads.statusSummaryReady', { count: readyCount })}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('downloads.statusSummaryReadyHint')}</Text>
    </View>
  );
}

function EmptyBanner({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border }]}
      testID="downloads.statusBanner.empty"
      accessibilityRole="summary"
      accessibilityLabel={t('downloads.statusSummaryEmpty')}
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('downloads.statusSummaryEmptyTitle')}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('downloads.statusSummaryEmpty')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  hint: { fontSize: 14, lineHeight: 20 },
  failureItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  failureDetail: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  failureActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
