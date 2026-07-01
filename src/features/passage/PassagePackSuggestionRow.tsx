import { StyleSheet, Text, View } from 'react-native';

import type { PassagePackSuggestionDetail } from '../../hooks/usePassagePackSuggestions';
import { isLargeRegionPack } from '../../map/regionPackValidation';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { DownloadProgressBar } from '../downloads/DownloadProgressBar';
import {
  isPackDownloadActive,
  packStatusBadgeVariant,
  packStatusLabel,
  seamarkStatusLabel,
} from '../downloads/packDownloadPresentation';

type Props = {
  suggestion: PassagePackSuggestionDetail;
  activeDownloadRegionId: string | null;
  busy: boolean;
  onDownload: () => void;
  onCancel?: () => void;
  onBrowsePack?: () => void;
};

export function PassagePackSuggestionRow({
  suggestion,
  activeDownloadRegionId,
  busy,
  onDownload,
  onCancel,
  onBrowsePack,
}: Props) {
  const { colors, minTouch, spacing } = useTheme();
  const { status } = suggestion;
  const largePack = isLargeRegionPack(suggestion.pack);
  const downloadActive = isPackDownloadActive(suggestion.packId, status, activeDownloadRegionId);
  const stateLabel = packStatusLabel(status);
  const seamarkLabel = seamarkStatusLabel(status);

  const downloadLabel = downloadActive
    ? t('downloads.downloading')
    : status.state === 'error'
      ? t('downloads.retryDownload')
      : t('passage.downloadPack');

  return (
    <View
      style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface, minHeight: minTouch }]}
      testID={`passage.suggestion.${suggestion.packId}`}
      accessibilityLabel={`${suggestion.label}. ${stateLabel}. ${t('passage.suggestionLegs', { count: suggestion.coversLegCount })}`}
    >
      <View style={styles.main}>
        <Text style={[styles.name, { color: colors.text }]} accessibilityRole="header">
          {suggestion.label}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>
          {t('passage.suggestionLegs', { count: suggestion.coversLegCount })} · ~{suggestion.sizeLabel}
        </Text>
        <StatusBadge label={stateLabel} variant={packStatusBadgeVariant(status)} />
        {downloadActive ? (
          <DownloadProgressBar percentage={status.percentage} label={stateLabel} testID={`passage.suggestion.progress.${suggestion.packId}`} />
        ) : null}
        {largePack && status.state !== 'ready' ? (
          <Text style={[styles.meta, { color: colors.warningText }]}>{t('downloads.largePackHint')}</Text>
        ) : null}
        {seamarkLabel ? (
          <Text style={[styles.meta, { color: colors.textMuted, marginTop: spacing.xs }]}>{seamarkLabel}</Text>
        ) : null}
        {status.error ? (
          <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {status.error}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {onBrowsePack ? (
          <Button
            label={t('downloads.previewPack')}
            variant="secondary"
            onPress={onBrowsePack}
            disabled={busy && !downloadActive}
            fullWidth={false}
            style={styles.actionBtn}
            testID={`passage.suggestion.preview.${suggestion.packId}`}
          />
        ) : null}
        {status.state === 'ready' ? null : downloadActive ? (
          <>
            <Button label={downloadLabel} onPress={() => {}} disabled loading fullWidth={false} style={styles.actionBtn} />
            {onCancel ? (
              <Button
                label={t('downloads.cancelDownload')}
                variant="secondary"
                onPress={onCancel}
                disabled={busy && activeDownloadRegionId !== suggestion.packId}
                fullWidth={false}
                style={styles.actionBtn}
                testID={`passage.suggestion.cancel.${suggestion.packId}`}
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
            testID={`passage.suggestion.download.${suggestion.packId}`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  main: { gap: 6 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexGrow: 1, flexBasis: '48%', minWidth: 120 },
});
