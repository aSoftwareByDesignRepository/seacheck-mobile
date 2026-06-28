import { StyleSheet, Text, View } from 'react-native';

import { resolveRegionPack } from '../../map/regionPacks';
import { t } from '../../i18n';
import type { RegionPackStatus } from '../../store/offlinePackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';

type Props = {
  status: RegionPackStatus;
  onDelete: () => void;
  busy: boolean;
};

/** Retired macro-region pack — offline data remains usable until deleted. */
export function LegacyPackCard({ status, onDelete, busy }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const def = resolveRegionPack(status.regionId);
  const name = def ? t(def.nameKey as 'downloads.packs.kielBay.name') : status.displayName ?? status.regionId;

  const stateLabel =
    status.state === 'ready'
      ? t('downloads.statusReady')
      : status.state === 'error'
        ? t('downloads.statusError')
        : t('downloads.statusIdle');

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: spacing.lg }]}
      testID={`downloads.legacy.${status.regionId}`}
      accessibilityLabel={`${name}. ${t('downloads.legacyRetiredNote')}. ${stateLabel}`}
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {name}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('downloads.legacyRetiredNote')}</Text>
      <Text style={[styles.state, { color: status.state === 'ready' ? colors.success : status.state === 'error' ? colors.danger : colors.textMuted }]}>
        {stateLabel}
      </Text>
      {status.error ? (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion="polite">
          {status.error}
        </Text>
      ) : null}
      <View style={[styles.actions, { minHeight: minTouch }]}>
        <Button
          label={t('downloads.delete')}
          variant="danger"
          onPress={onDelete}
          disabled={busy}
          testID={`downloads.legacy.delete.${status.regionId}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  state: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  error: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
