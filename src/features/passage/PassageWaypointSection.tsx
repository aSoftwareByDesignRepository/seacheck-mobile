import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import type { WaypointRow } from '../../lib/db/database';
import type { PassageWithLegs } from '../../store/passageStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';

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
  const inPassage = new Set(detail.waypoints.map((w) => w.id));
  const available = allWaypoints.filter((w) => !inPassage.has(w.id));
  const lastIndex = detail.waypoints.length - 1;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.lg }]} testID="passage.waypoints">
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('passage.waypointsTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('passage.waypointsBody')}</Text>

      {detail.waypoints.length === 0 ? (
        <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{t('passage.waypointsEmpty')}</Text>
      ) : (
        detail.waypoints.map((wp, index) => (
          <View key={wp.id} style={[styles.row, { borderColor: colors.border, minHeight: minTouch }]}>
            <Text style={[styles.order, { color: colors.primary }]}>{index + 1}</Text>
            <View style={styles.rowMain}>
              <Text style={[styles.name, { color: colors.text }]}>{wp.name}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>{wp.type}</Text>
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
              <Button label={t('passage.removeWaypoint')} variant="danger" onPress={() => onRemove(wp.id)} testID={`passage.remove.${wp.id}`} />
            </View>
          </View>
        ))
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexWrap: 'wrap' },
  order: { fontSize: 16, fontWeight: '800', width: 24, textAlign: 'center' },
  rowMain: { flex: 1, minWidth: 120 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 13, marginTop: 2 },
  actions: { gap: 8, width: '100%' },
  addLabel: { fontSize: 13, fontWeight: '700', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 14, lineHeight: 20 },
});
