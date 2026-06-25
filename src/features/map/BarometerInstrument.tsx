import { StyleSheet, Text, View } from 'react-native';

import type { BarometerStateSnapshot } from '../../services/barometerService';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  trend: BarometerStateSnapshot['trend'];
};

/** Compact environmental readout — same placement in every map layout. */
export function BarometerInstrument({ trend }: Props) {
  const { colors, spacing } = useTheme();
  if (trend.currentHpa == null) return null;

  const trendKey = `barometer.trend.${trend.trend}` as 'barometer.trend.steady';
  const trendLabel = t(trendKey);
  const deltaText =
    trend.delta3h != null ? `${trend.delta3h >= 0 ? '+' : ''}${trend.delta3h.toFixed(1)} hPa / 3 h` : null;
  const valueText = `${trend.currentHpa.toFixed(1)} hPa`;

  const a11yTrend = deltaText ? `${trendLabel}, ${deltaText}` : trendLabel;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          marginBottom: spacing.sm,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={t('barometer.a11y', { value: valueText, trend: a11yTrend })}
      testID="map.barometer"
    >
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('barometer.label')}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.text }]}>{valueText}</Text>
        <Text style={[styles.trend, { color: colors.textMuted }]}>{trendLabel}</Text>
        {deltaText ? <Text style={[styles.delta, { color: colors.textMuted }]}>{deltaText}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 14 },
  valueRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8, marginTop: 4 },
  value: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 22 },
  trend: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  delta: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'], lineHeight: 18 },
});
