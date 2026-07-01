import { StyleSheet, Text, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useTheme } from '../../theme/ThemeContext';
import type { InstrumentDetailMetric } from './instrumentDetailMetrics';

type Props = {
  metrics: InstrumentDetailMetric[];
  /** Horizontal chips for compact docks; grid for full-screen panels. */
  layout?: 'grid' | 'row';
};

export function InstrumentMetricGrid({ metrics, layout = 'grid' }: Props) {
  const { colors, spacing } = useTheme();
  const { width } = useFormFactor();

  if (metrics.length === 0) return null;

  if (layout === 'row') {
    return (
      <View style={[styles.row, { gap: spacing.sm }]}>
        {metrics.map((item) => (
          <View
            key={item.key}
            style={[styles.rowChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityLabel={`${item.label} ${item.value}${item.unit ? ` ${item.unit}` : ''}`}
          >
            <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
              {item.value}
              {item.unit ? <Text style={{ color: colors.textMuted, fontWeight: '600' }}> {item.unit}</Text> : null}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const columns = width >= 520 ? 3 : 2;
  const cellWidth = columns === 3 ? '31.5%' : '48%';

  return (
    <View style={[styles.grid, { gap: spacing.sm }]}>
      {metrics.map((item) => (
        <View
          key={item.key}
          style={[
            styles.gridCell,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              flexBasis: cellWidth,
              maxWidth: cellWidth,
            },
          ]}
          accessibilityLabel={`${item.label} ${item.value}${item.unit ? ` ${item.unit}` : ''}`}
        >
          <Text style={[styles.label, { color: colors.textMuted }]}>{item.label}</Text>
          <Text style={[styles.gridValue, { color: colors.text }]}>
            {item.value}
            {item.unit ? <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}> {item.unit}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  gridCell: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 72,
    justifyContent: 'center',
  },
  gridValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 6, lineHeight: 26 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  rowChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: '31%',
    minWidth: 96,
    minHeight: 56,
    justifyContent: 'center',
  },
  rowValue: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 4, lineHeight: 22 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 16 },
});
