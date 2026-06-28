import { StyleSheet, Text, View } from 'react-native';

import { isLargeRegionPack, validateRegionPack } from '../../map/regionPackValidation';
import { type RegionPackDefinition } from '../../map/regionPacks';
import { t } from '../../i18n';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';

type Props = {
  pack: RegionPackDefinition;
  status: RegionPackStatus;
  onDownload: () => void;
  onDelete: () => void;
  onCancel?: () => void;
  busy: boolean;
  onSelect?: () => void;
  selected?: boolean;
  recommended?: boolean;
};

export function RegionPackCard({ pack, status, onDownload, onDelete, onCancel, busy, onSelect, selected, recommended }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const packEstimate = validateRegionPack(pack);
  const sizeLabel = packEstimate.sizeLabel;
  const largePack = isLargeRegionPack(pack);

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

  const seamarkLabel =
    status.state !== 'ready'
      ? null
      : status.seamarksIndexing
        ? t('downloads.seamarksIndexing')
        : status.seamarksIndexed
          ? t('downloads.seamarksReady')
          : t('downloads.seamarksPending');

  const downloadLabel =
    status.state === 'downloading'
      ? t('downloads.downloading')
      : status.state === 'error'
        ? t('downloads.retryDownload')
        : t('downloads.download');

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border, marginBottom: spacing.lg }]}
      testID={`downloads.pack.${pack.id}`}
      accessibilityLabel={`${name}. ${stateLabel}${recommended ? `. ${t('downloads.recommendedBadge')}` : ''}${seamarkLabel ? `. ${seamarkLabel}` : ''}${status.error ? `. ${status.error}` : ''}`}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text, flex: 1 }]} accessibilityRole="header">
          {name}
        </Text>
        {recommended ? <StatusBadge label={t('downloads.recommendedBadge')} variant="warning" /> : null}
      </View>
      <Text style={[styles.body, { color: colors.textMuted }]}>{description}</Text>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {t('downloads.zoomRange', { min: pack.minZoom, max: pack.maxZoom })} · ~{sizeLabel} · {t('downloads.layersBoth')}
      </Text>
      {largePack && status.state !== 'ready' ? (
        <Text style={[styles.meta, { color: colors.warningText }]}>{t('downloads.largePackHint')}</Text>
      ) : null}
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
      <View style={[styles.actions, { minHeight: minTouch }]}>
        {onSelect ? (
          <Button
            label={t('downloads.previewPack')}
            variant="secondary"
            onPress={onSelect}
            disabled={busy}
            fullWidth={false}
            style={styles.actionBtn}
            testID={`downloads.preview.${pack.id}`}
          />
        ) : null}
        {status.state === 'ready' ? (
          <Button
            label={t('downloads.delete')}
            variant="danger"
            onPress={onDelete}
            disabled={busy}
            fullWidth={false}
            style={styles.actionBtn}
            testID={`downloads.delete.${pack.id}`}
          />
        ) : status.state === 'downloading' ? (
          <>
            <Button
              label={downloadLabel}
              onPress={onDownload}
              disabled
              loading
              fullWidth={false}
              style={styles.actionBtn}
              testID={`downloads.download.${pack.id}`}
            />
            {onCancel ? (
              <Button
                label={t('downloads.cancelDownload')}
                variant="secondary"
                onPress={onCancel}
                disabled={busy}
                fullWidth={false}
                style={styles.actionBtn}
                testID={`downloads.cancel.${pack.id}`}
              />
            ) : null}
          </>
        ) : (
          <Button
            label={downloadLabel}
            onPress={onDownload}
            disabled={busy}
            fullWidth={false}
            style={styles.actionBtn}
            testID={`downloads.download.${pack.id}`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  meta: { fontSize: 13, marginBottom: 8 },
  state: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  error: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexGrow: 1, flexBasis: '48%', minWidth: 140 },
});
