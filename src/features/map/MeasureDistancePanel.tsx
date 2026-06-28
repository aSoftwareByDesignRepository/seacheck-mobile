import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMapBottomLayout } from '../../hooks/useMapBottomLayout';
import { splitPlanningDuration } from '../../lib/geo/measureDuration';
import { formatMapDistanceLabel, computePathDistanceNm } from '../../lib/geo/pathDistance';
import { legDurationHours } from '../../lib/geo/navigation';
import { t } from '../../i18n';
import {
  MEASURE_PLANNING_SOG_PRESETS,
  useMeasureDistanceStore,
} from '../../store/measureDistanceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';

/** Bottom panel while measuring distance on the chart — total NM and planning time. */
export function MeasureDistancePanel() {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const mapBottom = useMapBottomLayout({ showSideActions: true });
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const active = useMeasureDistanceStore((s) => s.active);
  const points = useMeasureDistanceStore((s) => s.points);
  const planningSogKn = useMeasureDistanceStore((s) => s.planningSogKn);
  const totalNm = computePathDistanceNm(points);
  const durationHours = legDurationHours(totalNm, planningSogKn);
  const undoLast = useMeasureDistanceStore((s) => s.undoLast);
  const stop = useMeasureDistanceStore((s) => s.stop);
  const setPlanningSogKn = useMeasureDistanceStore((s) => s.setPlanningSogKn);

  if (!active) return null;

  const { hours, minutes } = splitPlanningDuration(durationHours);
  const hasPath = points.length >= 2;
  const hint =
    points.length === 0
      ? t('map.measureHintEmpty')
      : points.length === 1
        ? t('map.measureHintOnePoint')
        : t('map.measureHintMore');

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.sm), paddingRight: mapBottom.actionColumnWidth + 12 }]}
      testID="map.measure.panel"
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            gap: spacing.md,
            padding: spacing.lg,
          },
        ]}
        accessibilityViewIsModal
      >
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t('map.measureTitle')}
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>

        <View
          style={[styles.totalRow, { backgroundColor: colors.background, borderColor: colors.border }]}
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            hasPath
              ? t('map.measureTotalA11y', {
                  distance: formatMapDistanceLabel(totalNm, distanceUnit),
                  hours,
                  minutes,
                  sog: planningSogKn,
                })
              : t('map.measureNoDistanceYet')
          }
        >
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t('map.measureTotalLabel')}</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            {hasPath ? formatMapDistanceLabel(totalNm, distanceUnit) : '—'}
          </Text>
          {hasPath ? (
            <Text style={[styles.duration, { color: colors.textMuted }]}>
              {t('map.measureDuration', { hours, minutes, sog: planningSogKn })}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('map.measureSogLabel')}</Text>
          <View style={styles.chipRow}>
            {MEASURE_PLANNING_SOG_PRESETS.map((kn) => (
              <FilterChip
                key={kn}
                label={`${kn} kn`}
                selected={planningSogKn === kn}
                onPress={() => setPlanningSogKn(kn)}
                testID={`map.measure.sog.${kn}`}
              />
            ))}
          </View>
          <Text style={[styles.sogHint, { color: colors.textMuted }]}>{t('map.measureSogHint')}</Text>
        </View>

        <View style={[styles.actions, { minHeight: minTouch }]}>
          <Button
            label={t('map.measureUndo')}
            variant="secondary"
            fullWidth={false}
            onPress={undoLast}
            disabled={points.length === 0}
            style={styles.actionBtn}
            testID="map.measure.undo"
          />
          <Button
            label={t('map.measureDone')}
            onPress={stop}
            fullWidth={false}
            style={styles.actionBtn}
            testID="map.measure.done"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    elevation: 60,
    paddingHorizontal: 12,
  },
  card: { borderWidth: 1, borderRadius: 16 },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 24 },
  hint: { fontSize: 15, lineHeight: 22 },
  totalRow: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  totalLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  duration: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  section: { gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  sogHint: { fontSize: 13, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexGrow: 1, flexBasis: '48%', minWidth: 140 },
});
