import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

type Props = {
  status: RegionPackStatus;
  onDelete: () => void;
  busy: boolean;
};

export function CustomPackCard({ status, onDelete, busy }: Props) {
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

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.lg }]}
      testID={`downloads.custom.${status.regionId}`}
    >
      <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{t('downloads.customPackLabel')}</Text>
      <Text style={[styles.state, { color: stateColor }]} accessibilityLiveRegion="polite">
        {stateLabel}
      </Text>
      {status.error ? <Text style={[styles.error, { color: colors.danger }]}>{status.error}</Text> : null}
      {status.state === 'ready' ? (
        <View style={{ minHeight: minTouch }}>
          <Button label={t('downloads.delete')} variant="danger" onPress={onDelete} disabled={busy} testID={`downloads.custom.delete.${status.regionId}`} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  meta: { fontSize: 13, marginBottom: 8 },
  state: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  error: { fontSize: 13, marginBottom: 8 },
});
