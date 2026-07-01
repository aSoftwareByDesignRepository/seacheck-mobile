import { StyleSheet, Text, View } from 'react-native';

import { resolveRegionPack } from '../../map/regionPacks';
import { t } from '../../i18n';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { downloadsStyles } from './downloadsStyles';

type Props = {
  status: RegionPackStatus;
  onDelete: () => void;
  busy: boolean;
  variant?: 'card' | 'list';
  showDivider?: boolean;
};

/** Retired macro-region pack — offline data remains usable until deleted. */
export function LegacyPackCard({ status, onDelete, busy, variant = 'card', showDivider = false }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const def = resolveRegionPack(status.regionId);
  const name = def ? t(def.nameKey as 'downloads.packs.kielBay.name') : status.displayName ?? status.regionId;
  const listMode = variant === 'list';

  const stateLabel =
    status.state === 'ready'
      ? t('downloads.statusReady')
      : status.state === 'error'
        ? t('downloads.statusError')
        : t('downloads.statusIdle');

  const containerStyle = listMode
    ? [
        downloadsStyles.listItem,
        showDivider ? [downloadsStyles.listItemDivider, { borderTopColor: colors.border }] : null,
      ]
    : [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.lg }];

  return (
    <View
      style={containerStyle}
      testID={`downloads.legacy.${status.regionId}`}
      accessibilityLabel={`${name}. ${t('downloads.legacyRetiredNote')}. ${stateLabel}`}
    >
      <Text style={[downloadsStyles.packName, { color: colors.text }]} accessibilityRole="header">
        {name}
      </Text>
      <Text style={[downloadsStyles.packDescription, { color: colors.textMuted }]}>{t('downloads.legacyRetiredNote')}</Text>
      <Text
        style={[
          downloadsStyles.packMeta,
          { color: status.state === 'ready' ? colors.success : status.state === 'error' ? colors.danger : colors.textMuted, fontWeight: '700' },
        ]}
      >
        {stateLabel}
      </Text>
      {status.error ? (
        <Text style={[downloadsStyles.packError, { color: colors.danger }]} accessibilityLiveRegion="polite">
          {status.error}
        </Text>
      ) : null}
      <View style={[downloadsStyles.actions, { minHeight: minTouch }]}>
        <Button
          label={t('downloads.delete')}
          variant="danger"
          onPress={onDelete}
          disabled={busy}
          fullWidth={false}
          style={downloadsStyles.actionBtn}
          testID={`downloads.legacy.delete.${status.regionId}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
});
