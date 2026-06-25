import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

type Props = {
  status: RegionPackStatus;
  onDownload: () => void;
  onDelete: () => void;
  onCancel?: () => void;
  busy: boolean;
};

export function CustomPackCard({ status, onDownload, onDelete, onCancel, busy }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const name = status.displayName ?? status.regionId;

  const stateLabel =
    status.state === 'ready'
      ? t('downloads.statusReady')
      : status.state === 'downloading'
        ? t('downloads.statusDownloading', { percent: Math.round(status.percentage) })
        : status.state === 'error'
          ? t('downloads.statusError')
          : t('downloads.statusIdle');

  const stateColor =
    status.state === 'ready'
      ? colors.success
      : status.state === 'error'
        ? colors.danger
        : status.state === 'downloading'
          ? colors.primary
          : colors.textMuted;

  const seamarkLabel =
    status.state !== 'ready'
      ? null
      : status.seamarksIndexing
        ? t('downloads.seamarksIndexing')
        : status.seamarksIndexed
          ? t('downloads.seamarksReady')
          : t('downloads.seamarksPending');

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.lg }]}
      testID={`downloads.custom.${status.regionId}`}
      accessibilityLabel={`${name}. ${stateLabel}${seamarkLabel ? `. ${seamarkLabel}` : ''}${status.error ? `. ${status.error}` : ''}`}
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {name}
      </Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{t('downloads.customPackLabel')}</Text>
      <Text style={[styles.state, { color: stateColor }]} accessibilityLiveRegion="polite">
        {stateLabel}
      </Text>
      {seamarkLabel ? (
        <Text style={[styles.meta, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
          {seamarkLabel}
        </Text>
      ) : null}
      {status.error ? (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion="polite">
          {status.error}
        </Text>
      ) : null}
      <View style={[styles.actions, { minHeight: minTouch, gap: spacing.sm }]}>
        {status.state === 'ready' ? (
          <Button label={t('downloads.delete')} variant="danger" onPress={onDelete} disabled={busy} testID={`downloads.custom.delete.${status.regionId}`} />
        ) : status.state === 'downloading' ? (
          onCancel ? (
            <Button
              label={t('downloads.cancelDownload')}
              variant="secondary"
              onPress={onCancel}
              disabled={busy}
              testID={`downloads.custom.cancel.${status.regionId}`}
            />
          ) : null
        ) : (
          <>
            <Button
              label={t('downloads.retryDownload')}
              onPress={onDownload}
              disabled={busy}
              testID={`downloads.custom.retry.${status.regionId}`}
            />
            <Button
              label={t('downloads.delete')}
              variant="danger"
              onPress={onDelete}
              disabled={busy}
              testID={`downloads.custom.delete.${status.regionId}`}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  meta: { fontSize: 13, marginBottom: 8 },
  state: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  error: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  actions: { gap: 8 },
});
