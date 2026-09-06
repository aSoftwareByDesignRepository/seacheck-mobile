import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useOfflinePackStore } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
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
 * Replaces the live chart while DownloadMapEngine owns the sole Android GL context.
 * Must stay readable (WCAG) — never a blank dark void with no progress or action.
 */
export function ChartDownloadSessionPlaceholder({ onOpenDownloads, testID = 'map.downloadSession' }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const activeDownloadRegionId = useOfflinePackStore((s) => s.activeDownloadRegionId);
  const downloadMapTeardownRegionId = useOfflinePackStore((s) => s.downloadMapTeardownRegionId);
  const sessionRegionId = activeDownloadRegionId ?? downloadMapTeardownRegionId;
  const status = useOfflinePackStore((s) => (sessionRegionId != null ? s.regions[sessionRegionId] : undefined));

  const name = resolvePackDisplayName(status ?? { regionId: sessionRegionId ?? 'pack' });
  const downloading = status?.state === 'downloading';
  const percent = status?.percentage ?? 0;
  const completing = status?.state === 'ready' || (downloading && percent >= 99);
  const initializing =
    (downloading && !completing && (status?.downloadInitializing || percent <= 0)) ||
    (activeDownloadRegionId != null && !downloading && status?.state !== 'ready' && status?.state !== 'error');
  const active =
    sessionRegionId != null &&
    isPackDownloadActive(sessionRegionId, status ?? { state: 'idle' }, activeDownloadRegionId);

  const title = completing
    ? t('downloads.statusSummaryCompletingTitle')
    : t('downloads.statusSummaryActiveTitle');
  const body = completing
    ? t('downloads.statusSummaryCompleting', { name })
    : initializing
      ? t('downloads.statusSummaryActiveInitializing', { name })
      : t('downloads.statusSummaryActive', { name, percent: Math.round(percent) });
  const a11yLabel = `${title}. ${body}. ${t('downloads.mapSessionHint')}`;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.surface,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: completing ? colors.successBg : colors.warningBg,
            borderColor: completing ? colors.success : colors.warningBorder,
            gap: spacing.sm,
          },
        ]}
      >
        <Text
          style={[styles.title, { color: completing ? colors.success : colors.warningText }]}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>{body}</Text>
        {active && !completing ? (
          <DownloadProgressBar
            percentage={percent}
            indeterminate={initializing}
            label={packStatusLabel({
              state: 'downloading',
              percentage: percent,
              error: null,
              downloadInitializing: status?.downloadInitializing || initializing,
            })}
            testID={`${testID}.progress`}
          />
        ) : null}
        {completing ? (
          <Text style={[styles.hint, { color: colors.text }]}>{t('downloads.statusCompleting')}</Text>
        ) : null}
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('downloads.mapSessionHint')}</Text>
        <View style={{ minHeight: minTouch, marginTop: spacing.xs }}>
          <Button
            label={t('map.openDownloads')}
            onPress={onOpenDownloads}
            accessibilityHint={t('downloads.mapSessionOpenHint')}
            testID={`${testID}.openDownloads`}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 24, textAlign: 'center' },
  body: { fontSize: 16, fontWeight: '600', lineHeight: 24, textAlign: 'center' },
  hint: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
