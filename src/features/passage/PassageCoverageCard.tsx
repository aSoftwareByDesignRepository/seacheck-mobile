import { StyleSheet, Text, View } from 'react-native';

import { usePassageCoverage } from '../../hooks/usePassageCoverage';
import { t } from '../../i18n';
import type { PassageWithLegs } from '../../store/passageStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { StatusBadge } from '../../ui/StatusBadge';

type Props = {
  detail: PassageWithLegs;
  onOpenDownloads: () => void;
};

export function PassageCoverageCard({ detail, onOpenDownloads }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const report = usePassageCoverage(detail.waypoints);

  if (detail.waypoints.length < 2) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.lg }]} testID="passage.coverage">
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('passage.offlineCheckTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('passage.offlineCheckBody')}</Text>

      {report.readyPackCount === 0 ? (
        <StatusBadge label={t('passage.offlineNoPacks')} variant="danger" />
      ) : report.fullyCovered ? (
        <StatusBadge label={t('passage.offlineReady')} variant="success" />
      ) : (
        <StatusBadge label={t('passage.offlineGaps', { count: report.uncoveredLegCount })} variant="warning" />
      )}

      {report.legs.map((leg) => (
        <View key={leg.legIndex} style={[styles.legRow, { borderColor: colors.border, minHeight: minTouch }]}>
          <View style={styles.legMain}>
            <Text style={[styles.legTitle, { color: colors.text }]}>
              {leg.fromName} → {leg.toName}
            </Text>
            {leg.covered && leg.coveringPackLabels.length ? (
              <Text style={[styles.legMeta, { color: colors.textMuted }]} numberOfLines={2}>
                {t('passage.offlineCoveredBy', { packs: leg.coveringPackLabels.join(', ') })}
              </Text>
            ) : null}
          </View>
          <StatusBadge
            label={leg.covered ? t('passage.offlineLegOk') : t('passage.offlineLegGap')}
            variant={leg.covered ? 'success' : 'warning'}
          />
        </View>
      ))}

      {!report.fullyCovered ? (
        <Button label={t('passage.openDownloads')} variant="secondary" onPress={onOpenDownloads} testID="passage.openDownloads" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  legMain: { flex: 1 },
  legTitle: { fontSize: 15, fontWeight: '600' },
  legMeta: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
