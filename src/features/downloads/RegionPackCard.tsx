import { StyleSheet, Text, View } from 'react-native';

import { isLargeRegionPack, validateRegionPack } from '../../map/regionPackValidation';
import { type RegionPackDefinition } from '../../map/regionPacks';
import { t } from '../../i18n';
import { reportDownloadFailureFromRegion } from '../../lib/offline/reportDownloadFailure';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';
import { DownloadProgressBar } from './DownloadProgressBar';
import { downloadsStyles } from './downloadsStyles';
import {
  isPackDownloadActive,
  packHasDownloadFailure,
  packStatusBadgeVariant,
  packStatusLabel,
  seamarkStatusLabel,
} from './packDownloadPresentation';

type Props = {
  pack: RegionPackDefinition;
  status: RegionPackStatus;
  activeDownloadRegionId: string | null;
  onDownload: () => void;
  onDelete: () => void;
  onCancel?: () => void;
  busy: boolean;
  onSelect?: () => void;
  selected?: boolean;
  recommended?: boolean;
  testPack?: boolean;
  /** Compact row inside a grouped card — description moves to the preview pane. */
  variant?: 'card' | 'list';
  /** Divider above list rows (not the first item). */
  showDivider?: boolean;
  /** Hide per-row progress when the screen banner already shows the active download. */
  suppressActiveProgress?: boolean;
};

export function RegionPackCard({
  pack,
  status,
  activeDownloadRegionId,
  onDownload,
  onDelete,
  onCancel,
  busy,
  onSelect,
  selected,
  recommended,
  testPack,
  variant = 'card',
  showDivider = false,
  suppressActiveProgress = false,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const packEstimate = validateRegionPack(pack);
  const sizeLabel = packEstimate.sizeLabel;
  const largePack = isLargeRegionPack(pack);
  const downloadActive = isPackDownloadActive(pack.id, status, activeDownloadRegionId);
  const listMode = variant === 'list';

  const name = t(pack.nameKey as 'downloads.packs.kielBay.name');
  const description = t(pack.descriptionKey as 'downloads.packs.kielBay.description');
  const stateLabel = packStatusLabel(status);
  const seamarkLabel = seamarkStatusLabel(status);

  const downloadLabel = downloadActive
    ? t('downloads.downloading')
    : packHasDownloadFailure(status)
      ? t('downloads.retryDownload')
      : t('downloads.download');

  const a11yParts = [name, stateLabel];
  if (recommended) a11yParts.push(t('downloads.recommendedBadge'));
  if (testPack) a11yParts.push(t('downloads.testPackBadge'));
  if (seamarkLabel) a11yParts.push(seamarkLabel);
  if (status.error) a11yParts.push(status.error);

  const showProgress = downloadActive && !(suppressActiveProgress && downloadActive);

  const containerStyle = listMode
    ? [
        downloadsStyles.listItem,
        showDivider ? [downloadsStyles.listItemDivider, { borderTopColor: colors.border }] : null,
        selected
          ? [
              downloadsStyles.listItemSelected,
              { backgroundColor: colors.primary + '12', borderColor: colors.primary },
            ]
          : null,
        testPack && !selected
          ? [
              downloadsStyles.listItemSelected,
              { backgroundColor: colors.successBg, borderColor: colors.success, borderWidth: 1 },
            ]
          : null,
      ]
    : [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : testPack ? colors.primary : colors.border,
          borderWidth: testPack && !selected ? 2 : 1,
          marginBottom: spacing.lg,
        },
      ];

  return (
    <View
      style={containerStyle}
      testID={`downloads.pack.${pack.id}`}
      accessibilityLabel={a11yParts.join('. ')}
    >
      <View style={downloadsStyles.titleRow}>
        <Text style={[downloadsStyles.packName, { color: colors.text, flex: 1 }]} accessibilityRole="header">
          {name}
        </Text>
        <View style={downloadsStyles.badges}>
          {testPack ? <StatusBadge label={t('downloads.testPackBadge')} variant="success" /> : null}
          {recommended ? <StatusBadge label={t('downloads.recommendedBadge')} variant="warning" /> : null}
          {listMode ? <StatusBadge label={stateLabel} variant={packStatusBadgeVariant(status)} /> : null}
        </View>
      </View>

      {!listMode ? <Text style={[downloadsStyles.packDescription, { color: colors.textMuted }]}>{description}</Text> : null}
      {testPack && status.state !== 'ready' ? (
        <View
          style={[
            downloadsStyles.testPackCallout,
            {
              backgroundColor: colors.successBg,
              borderColor: colors.success,
            },
          ]}
          accessibilityRole="text"
        >
          <Text style={[styles.callout, { color: colors.success, marginBottom: 0 }]}>{t('downloads.testPackHint')}</Text>
        </View>
      ) : null}

      <Text style={[downloadsStyles.packMeta, { color: colors.textMuted }]}>
        {t('downloads.zoomRange', { min: pack.minZoom, max: pack.maxZoom })} · ~{sizeLabel}
        {listMode ? null : ` · ${t('downloads.layersBoth')}`}
      </Text>

      {largePack && status.state !== 'ready' ? (
        <Text style={[downloadsStyles.packMeta, { color: colors.warningText }]}>{t('downloads.largePackHint')}</Text>
      ) : null}

      {!listMode ? (
        <View style={downloadsStyles.statusRow}>
          <StatusBadge label={stateLabel} variant={packStatusBadgeVariant(status)} />
        </View>
      ) : null}

      {showProgress ? (
        <DownloadProgressBar
          percentage={status.percentage}
          label={stateLabel}
          testID={`downloads.progress.${pack.id}`}
        />
      ) : null}

      {seamarkLabel ? (
        <Text style={[downloadsStyles.packMeta, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
          {seamarkLabel}
        </Text>
      ) : null}
      {status.error ? (
        <>
          <Text
            style={[downloadsStyles.packError, { color: colors.danger }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {status.error}
          </Text>
          <Button
            label={t('downloads.failureModal.viewReport')}
            variant="secondary"
            onPress={() => reportDownloadFailureFromRegion(pack.id)}
            fullWidth={false}
            style={downloadsStyles.actionBtn}
            testID={`downloads.report.${pack.id}`}
          />
        </>
      ) : null}

      <View style={[downloadsStyles.actions, { minHeight: minTouch, marginTop: listMode ? spacing.xs : spacing.md }]}>
        {onSelect ? (
          <Button
            label={t('downloads.previewPack')}
            variant="secondary"
            onPress={onSelect}
            disabled={busy && !downloadActive}
            fullWidth={false}
            style={downloadsStyles.actionBtn}
            testID={`downloads.preview.${pack.id}`}
          />
        ) : null}
        {status.state === 'ready' && !packHasDownloadFailure(status) ? (
          <Button
            label={t('downloads.delete')}
            variant="danger"
            onPress={onDelete}
            disabled={busy}
            fullWidth={false}
            style={downloadsStyles.actionBtn}
            testID={`downloads.delete.${pack.id}`}
          />
        ) : downloadActive ? (
          <>
            <Button
              label={downloadLabel}
              onPress={onDownload}
              disabled
              loading
              fullWidth={false}
              style={downloadsStyles.actionBtn}
              testID={`downloads.download.${pack.id}`}
            />
            {onCancel ? (
              <Button
                label={t('downloads.cancelDownload')}
                variant="secondary"
                onPress={onCancel}
                disabled={busy && activeDownloadRegionId !== pack.id}
                fullWidth={false}
                style={downloadsStyles.actionBtn}
                testID={`downloads.cancel.${pack.id}`}
              />
            ) : null}
          </>
        ) : packHasDownloadFailure(status) ? (
          <>
            <Button
              label={downloadLabel}
              onPress={onDownload}
              disabled={busy}
              fullWidth={false}
              style={downloadsStyles.actionBtn}
              testID={`downloads.download.${pack.id}`}
            />
            <Button
              label={t('downloads.delete')}
              variant="danger"
              onPress={onDelete}
              disabled={busy}
              fullWidth={false}
              style={downloadsStyles.actionBtn}
              testID={`downloads.delete.${pack.id}`}
            />
          </>
        ) : (
          <Button
            label={downloadLabel}
            onPress={onDownload}
            disabled={busy}
            fullWidth={false}
            style={downloadsStyles.actionBtn}
            testID={`downloads.download.${pack.id}`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16 },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginBottom: 8 },
});
