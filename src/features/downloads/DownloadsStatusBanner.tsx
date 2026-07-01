import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { reportDownloadFailureFromRegion } from '../../lib/offline/reportDownloadFailure';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { DownloadProgressBar } from './DownloadProgressBar';
import {
  countReadyPacks,
  isPackDownloadActive,
  listFailedPacks,
  packStatusLabel,
  resolvePackDisplayName,
} from './packDownloadPresentation';

type Props = {
  regions: Record<string, RegionPackStatus>;
  activeDownloadRegionId: string | null;
  hydrated: boolean;
  onCancelActive?: () => void;
  cancelBusy?: boolean;
  onRetryFailed?: (regionId: string) => void;
  retryBusyId?: string | null;
};

export function DownloadsStatusBanner({
  regions,
  activeDownloadRegionId,
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

  return (
    <View style={{ gap: spacing.md, marginBottom: spacing.lg }} testID="downloads.statusBanners">
      {activeDownloadRegionId ? (
        <ActiveDownloadBanner
          regions={regions}
          activeDownloadRegionId={activeDownloadRegionId}
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

      {!activeDownloadRegionId && failedPacks.length === 0 ? (
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
  activeDownloadRegionId,
  onCancelActive,
  cancelBusy,
  colors,
  spacing,
  minTouch,
}: {
  regions: Record<string, RegionPackStatus>;
  activeDownloadRegionId: string;
  onCancelActive?: () => void;
  cancelBusy: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  minTouch: number;
}) {
  const active = regions[activeDownloadRegionId];
  const name = resolvePackDisplayName(active ?? { regionId: activeDownloadRegionId });
  const downloading = active && isPackDownloadActive(activeDownloadRegionId, active, activeDownloadRegionId);
  const percent = active?.percentage ?? 0;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}
      testID="downloads.statusBanner.active"
      accessibilityRole="summary"
      accessibilityLabel={t('downloads.statusSummaryActive', { name, percent: Math.round(percent) })}
    >
      <Text style={[styles.title, { color: colors.warningText }]} accessibilityRole="header">
        {t('downloads.statusSummaryActiveTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.text }]}>{name}</Text>
      {downloading ? (
        <DownloadProgressBar
          percentage={percent}
          label={packStatusLabel({ state: 'downloading', percentage: percent, error: null })}
          testID="downloads.statusBanner.progress"
        />
      ) : null}
      <Text style={[styles.hint, { color: colors.textMuted }]}>{t('downloads.statusSummaryActiveHint')}</Text>
      {onCancelActive ? (
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
