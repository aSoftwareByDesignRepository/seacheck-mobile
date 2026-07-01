import { StyleSheet, Text, View } from 'react-native';

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
  packStatusBadgeVariant,
  packStatusLabel,
  seamarkStatusLabel,
} from './packDownloadPresentation';

type Props = {
  status: RegionPackStatus;
  activeDownloadRegionId: string | null;
  onDownload: () => void;
  onDelete: () => void;
  onCancel?: () => void;
  busy: boolean;
  variant?: 'card' | 'list';
  showDivider?: boolean;
  suppressActiveProgress?: boolean;
};

export function CustomPackCard({
  status,
  activeDownloadRegionId,
  onDownload,
  onDelete,
  onCancel,
  busy,
  variant = 'card',
  showDivider = false,
  suppressActiveProgress = false,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const name = status.displayName ?? status.regionId;
  const downloadActive = isPackDownloadActive(status.regionId, status, activeDownloadRegionId);
  const stateLabel = packStatusLabel(status);
  const seamarkLabel = seamarkStatusLabel(status);
  const listMode = variant === 'list';
  const showProgress = downloadActive && !(suppressActiveProgress && downloadActive);

  const a11yParts = [name, t('downloads.customPackLabel'), stateLabel];
  if (seamarkLabel) a11yParts.push(seamarkLabel);
  if (status.error) a11yParts.push(status.error);

  const containerStyle = listMode
    ? [
        downloadsStyles.listItem,
        showDivider ? [downloadsStyles.listItemDivider, { borderTopColor: colors.border }] : null,
      ]
    : [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.lg }];

  return (
    <View
      style={containerStyle}
      testID={`downloads.custom.${status.regionId}`}
      accessibilityLabel={a11yParts.join('. ')}
    >
      <View style={downloadsStyles.titleRow}>
        <Text style={[downloadsStyles.packName, { color: colors.text, flex: 1 }]} accessibilityRole="header">
          {name}
        </Text>
        {listMode ? <StatusBadge label={stateLabel} variant={packStatusBadgeVariant(status)} /> : null}
      </View>
      {!listMode ? (
        <Text style={[downloadsStyles.packMeta, { color: colors.textMuted }]}>{t('downloads.customPackLabel')}</Text>
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
          testID={`downloads.custom.progress.${status.regionId}`}
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
            onPress={() => reportDownloadFailureFromRegion(status.regionId)}
            fullWidth={false}
            style={downloadsStyles.actionBtn}
            testID={`downloads.custom.report.${status.regionId}`}
          />
        </>
      ) : null}

      <View style={[downloadsStyles.actions, { minHeight: minTouch, marginTop: listMode ? spacing.xs : spacing.md }]}>
        {status.state === 'ready' ? (
          <Button
            label={t('downloads.delete')}
            variant="danger"
            onPress={onDelete}
            disabled={busy}
            fullWidth={false}
            style={downloadsStyles.actionBtn}
            testID={`downloads.custom.delete.${status.regionId}`}
          />
        ) : downloadActive ? (
          <>
            <Button
              label={t('downloads.downloading')}
              onPress={onDownload}
              disabled
              loading
              fullWidth={false}
              style={downloadsStyles.actionBtn}
              testID={`downloads.custom.downloading.${status.regionId}`}
            />
            {onCancel ? (
              <Button
                label={t('downloads.cancelDownload')}
                variant="secondary"
                onPress={onCancel}
                disabled={busy && activeDownloadRegionId !== status.regionId}
                fullWidth={false}
                style={downloadsStyles.actionBtn}
                testID={`downloads.custom.cancel.${status.regionId}`}
              />
            ) : null}
          </>
        ) : status.state === 'error' ? (
          <>
            <Button
              label={t('downloads.retryDownload')}
              onPress={onDownload}
              disabled={busy}
              fullWidth={false}
              style={downloadsStyles.actionBtn}
              testID={`downloads.custom.retry.${status.regionId}`}
            />
            <Button
              label={t('downloads.delete')}
              variant="danger"
              onPress={onDelete}
              disabled={busy}
              fullWidth={false}
              style={downloadsStyles.actionBtn}
              testID={`downloads.custom.delete.${status.regionId}`}
            />
          </>
        ) : (
          <Button
            label={t('downloads.download')}
            onPress={onDownload}
            disabled={busy}
            fullWidth={false}
            style={downloadsStyles.actionBtn}
            testID={`downloads.custom.download.${status.regionId}`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
});
