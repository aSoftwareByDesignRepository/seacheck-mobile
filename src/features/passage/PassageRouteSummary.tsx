import { StyleSheet, Text, View } from 'react-native';

import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { t } from '../../i18n';
import type { PassageWithLegs } from '../../store/passageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  detail: PassageWithLegs;
};

/** At-a-glance planned route distance — legs, total length, planned duration. */
export function PassageRouteSummary({ detail }: Props) {
  const { colors, spacing } = useTheme();
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);

  if (detail.waypoints.length < 2 || detail.legs.length === 0) return null;

  const distanceText = `${formatDistanceNm(detail.totalNm, distanceUnit)} ${distanceUnitLabel(distanceUnit)}`;
  const unitLabel = distanceUnitLabel(distanceUnit);

  return (
    <View
      style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: spacing.sm }]}
      accessibilityRole="summary"
      accessibilityLabel={t('passage.routeSummaryA11y', {
        legs: detail.legs.length,
        distance: formatDistanceNm(detail.totalNm, distanceUnit),
        unit: unitLabel,
        hours: detail.totalHours.toFixed(1),
      })}
      testID="passage.routeSummary"
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('passage.routeSummaryTitle')}
      </Text>
      <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.sm }]}>
        <Stat label={t('passage.routeSummaryLegs')} value={String(detail.legs.length)} colors={colors} />
        <Stat label={t('passage.routeSummaryDistance')} value={distanceText} colors={colors} />
        <Stat label={t('passage.routeSummaryDuration')} value={`${detail.totalHours.toFixed(1)} h`} colors={colors} />
      </View>
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: { text: string; textMuted: string } }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  title: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 96 },
  statLabel: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  statValue: { fontSize: 17, fontWeight: '800', lineHeight: 24, marginTop: 4, fontVariant: ['tabular-nums'] },
});
