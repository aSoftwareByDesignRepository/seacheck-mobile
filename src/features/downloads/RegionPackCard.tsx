import { StyleSheet, Text, View } from 'react-native';

import { estimateDownloadKb, estimateTileCount, formatStorageSize } from '../../map/tileMath';
import { REGION_PACKS, type RegionPackDefinition } from '../../map/regionPacks';
import { t } from '../../i18n';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

type Props = {
  pack: RegionPackDefinition;
  status: RegionPackStatus;
  onDownload: () => void;
  onDelete: () => void;
  busy: boolean;
};

export function RegionPackCard({ pack, status, onDownload, onDelete, busy }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const tileEstimate = estimateTileCount(pack.bounds, pack.minZoom, pack.maxZoom);
  const sizeLabel = formatStorageSize(estimateDownloadKb(tileEstimate));

  const name = t(pack.nameKey as 'downloads.packs.kielBay.name');
  const description = t(pack.descriptionKey as 'downloads.packs.kielBay.description');

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
      testID={`downloads.pack.${pack.id}`}
    >
      <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{description}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        z{pack.minZoom}–{pack.maxZoom} · ~{sizeLabel} · {t('downloads.layersBoth')}
      </Text>
      <Text style={[styles.state, { color: stateColor }]} accessibilityLiveRegion="polite">
        {stateLabel}
      </Text>
      {status.error ? <Text style={[styles.error, { color: colors.danger }]}>{status.error}</Text> : null}
      <View style={[styles.actions, { minHeight: minTouch }]}>
        {status.state === 'ready' ? (
          <Button
            label={t('downloads.delete')}
            variant="danger"
            onPress={onDelete}
            disabled={busy}
            testID={`downloads.delete.${pack.id}`}
          />
        ) : (
          <Button
            label={status.state === 'downloading' ? t('downloads.downloading') : t('downloads.download')}
            onPress={onDownload}
            disabled={busy || status.state === 'downloading'}
            loading={status.state === 'downloading'}
            testID={`downloads.download.${pack.id}`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  meta: { fontSize: 13, marginBottom: 8 },
  state: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  error: { fontSize: 13, marginBottom: 8 },
  actions: { gap: 8 },
});
