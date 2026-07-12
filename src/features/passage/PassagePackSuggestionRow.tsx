import { Text, View } from 'react-native';

import type { PassagePackSuggestionDetail } from '../../hooks/usePassagePackSuggestions';
import { isLargeRegionPack } from '../../map/regionPackValidation';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { DownloadProgressBar } from '../downloads/DownloadProgressBar';
import { downloadsStyles } from '../downloads/downloadsStyles';
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
  showDivider?: boolean;
  /** Hide per-row progress when another pack is downloading. */
  suppressActiveProgress?: boolean;
};

export function PassagePackSuggestionRow({
  suggestion,
  activeDownloadRegionId,
  busy,
  onDownload,
  onCancel,
  onBrowsePack,
  showDivider = false,
  suppressActiveProgress = false,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { status } = suggestion;
  const largePack = isLargeRegionPack(suggestion.pack);
  const downloadActive = isPackDownloadActive(suggestion.packId, status, activeDownloadRegionId);
  const stateLabel = packStatusLabel(status);
  const seamarkLabel = seamarkStatusLabel(status);
  const showProgress = downloadActive && !(suppressActiveProgress && downloadActive);

  const downloadLabel = downloadActive
    ? t('downloads.downloading')
    : status.state === 'error'
      ? t('downloads.retryDownload')
      : t('passage.downloadPack');

  const a11yParts = [
    suggestion.label,
    stateLabel,
    t('passage.suggestionLegs', { count: suggestion.coversLegCount }),
    `~${suggestion.sizeLabel}`,
  ];
  if (seamarkLabel) a11yParts.push(seamarkLabel);
  if (status.error) a11yParts.push(status.error);

  return (
    <View
      style={[
        downloadsStyles.listItem,
        showDivider ? [downloadsStyles.listItemDivider, { borderTopColor: colors.border }] : null,
      ]}
      testID={`passage.suggestion.${suggestion.packId}`}
      accessibilityLabel={a11yParts.join('. ')}
    >
      <View style={downloadsStyles.titleRow}>
        <Text style={[downloadsStyles.packName, { color: colors.text, flex: 1 }]} accessibilityRole="header">
          {suggestion.label}
        </Text>
        <View style={downloadsStyles.badges}>
          <StatusBadge label={stateLabel} variant={packStatusBadgeVariant(status)} />
        </View>
      </View>

      <Text style={[downloadsStyles.packMeta, { color: colors.textMuted }]}>
        {t('passage.suggestionLegs', { count: suggestion.coversLegCount })} · ~{suggestion.sizeLabel}
      </Text>

      {largePack && status.state !== 'ready' ? (
        <Text style={[downloadsStyles.packMeta, { color: colors.warningText }]}>{t('downloads.largePackHint')}</Text>
      ) : null}

      {showProgress ? (
        <DownloadProgressBar
          percentage={status.percentage}
          label={stateLabel}
          showLabel={false}
          testID={`passage.suggestion.progress.${suggestion.packId}`}
        />
      ) : null}

      {seamarkLabel ? (
        <Text style={[downloadsStyles.packMeta, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
          {seamarkLabel}
        </Text>
      ) : null}

      {status.error ? (
        <Text
          style={[downloadsStyles.packError, { color: colors.danger }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {status.error}
        </Text>
      ) : null}

      <View style={[downloadsStyles.actions, { minHeight: minTouch, marginTop: spacing.xs }]}>
        {onBrowsePack ? (
          <Button
            label={t('downloads.previewPack')}
            variant="secondary"
            onPress={onBrowsePack}
            disabled={busy && !downloadActive}
            fullWidth={false}
            style={downloadsStyles.actionBtn}
            testID={`passage.suggestion.preview.${suggestion.packId}`}
          />
        ) : null}
        {status.state === 'ready' ? null : downloadActive ? (
          <>
            <Button
              label={downloadLabel}
              onPress={() => {}}
              disabled
              loading
              fullWidth={false}
              style={downloadsStyles.actionBtn}
            />
            {onCancel ? (
              <Button
                label={t('downloads.cancelDownload')}
                variant="secondary"
                onPress={onCancel}
                disabled={busy && activeDownloadRegionId !== suggestion.packId}
                fullWidth={false}
                style={downloadsStyles.actionBtn}
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
            style={downloadsStyles.actionBtn}
            testID={`passage.suggestion.download.${suggestion.packId}`}
          />
        )}
      </View>
    </View>
  );
}
