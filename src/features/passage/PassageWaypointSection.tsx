import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import type { WaypointRow } from '../../lib/db/database';
import type { PassageWithLegs } from '../../store/passageStore';
import { useNavigationStore } from '../../store/navigationStore';
import { usePassageStore } from '../../store/passageStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';
import { StatusBadge } from '../../ui/StatusBadge';

type Props = {
  detail: PassageWithLegs;
  allWaypoints: WaypointRow[];
  onAdd: (waypointId: string) => void;
  onRemove: (waypointId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
};

export function PassageWaypointSection({ detail, allWaypoints, onAdd, onRemove, onMoveUp, onMoveDown }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const activePassageId = usePassageStore((s) => s.activePassageId);
  const activeLegIndex = useNavigationStore((s) => s.activeLegIndex);
  const unitLabel = distanceUnitLabel(distanceUnit);
  const isFollowingThisPassage = activePassageId === detail.id;
  const nextWaypointIndex = isFollowingThisPassage ? activeLegIndex + 1 : -1;

  const inPassage = new Set(detail.waypoints.map((w) => w.id));
  const available = allWaypoints.filter((w) => !inPassage.has(w.id));
  const lastIndex = detail.waypoints.length - 1;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.lg }]}
      testID="passage.waypoints"
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('passage.waypointsTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('passage.waypointsBody')}</Text>

      {detail.waypoints.length === 0 ? (
        <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{t('passage.waypointsEmpty')}</Text>
      ) : (
        detail.waypoints.map((wp, index) => {
          const leg = index > 0 ? detail.legs[index - 1] : null;
          const isNext = index === nextWaypointIndex;
          return (
            <View
              key={wp.id}
              style={[
                styles.row,
                {
                  borderColor: isNext ? colors.primary : colors.border,
                  backgroundColor: isNext ? colors.background : undefined,
                  minHeight: minTouch,
                },
                isNext ? styles.rowActive : null,
              ]}
              accessibilityLabel={
                isNext
                  ? `${wp.name}. ${t('passage.waypointNextA11y')}`
                  : leg
                    ? `${wp.name}. ${t('passage.waypointLegMeta', {
                        brg: Math.round(leg.bearingDeg),
                        dist: formatDistanceNm(leg.distanceNm, distanceUnit),
                        unit: unitLabel,
                      })}`
                    : wp.name
              }
            >
              <Text style={[styles.order, { color: isNext ? colors.primary : colors.textMuted }]}>{index + 1}</Text>
              <View style={styles.rowMain}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.text }]}>{wp.name}</Text>
                  {isNext ? <StatusBadge label={t('passage.nextWaypointBadge')} variant="success" /> : null}
                </View>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{wp.type}</Text>
                {leg ? (
                  <Text style={[styles.legMeta, { color: colors.textMuted }]}>
                    {t('passage.waypointLegMeta', {
                      brg: Math.round(leg.bearingDeg),
                      dist: formatDistanceNm(leg.distanceNm, distanceUnit),
                      unit: unitLabel,
                    })}
                  </Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <Button
                  label={t('passage.moveUp')}
                  variant="secondary"
                  onPress={() => onMoveUp(index)}
                  testID={`passage.moveUp.${wp.id}`}
                  disabled={index === 0}
                />
                <Button
                  label={t('passage.moveDown')}
                  variant="secondary"
                  onPress={() => onMoveDown(index)}
                  testID={`passage.moveDown.${wp.id}`}
                  disabled={index === lastIndex}
                />
                <Button
                  label={t('passage.removeWaypoint')}
                  variant="danger"
                  onPress={() => onRemove(wp.id)}
                  testID={`passage.remove.${wp.id}`}
                />
              </View>
            </View>
          );
        })
      )}

      {available.length > 0 ? (
        <>
          <Text style={[styles.addLabel, { color: colors.textMuted }]}>{t('passage.addWaypoint')}</Text>
          <View style={styles.chips}>
            {available.map((wp) => (
              <FilterChip key={wp.id} label={wp.name} selected={false} onPress={() => onAdd(wp.id)} testID={`passage.add.${wp.id}`} />
            ))}
          </View>
        </>
      ) : (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{t('passage.noMoreWaypoints')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  title: { fontSize: 17, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexWrap: 'wrap',
  },
  rowActive: { borderWidth: 2 },
  order: { fontSize: 16, fontWeight: '800', width: 24, textAlign: 'center' },
  rowMain: { flex: 1, minWidth: 120 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 2 },
  legMeta: { fontSize: 13, marginTop: 4, lineHeight: 18, fontVariant: ['tabular-nums'] },
  actions: { gap: 8, width: '100%' },
  addLabel: { fontSize: 13, fontWeight: '700', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 14, lineHeight: 20 },
});
