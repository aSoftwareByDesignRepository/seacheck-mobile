import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { WaypointRow, WaypointType } from '../../lib/db/database';
import { t } from '../../i18n';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { CoordinateBlock } from '../../ui/CoordinateBlock';
import { FilterChip } from '../../ui/FilterChip';
import { Card, FieldInput, FieldLabel } from '../../ui/Screen';

const WAYPOINT_TYPES: WaypointType[] = ['harbour', 'anchorage', 'mark', 'hazard', 'mob', 'generic'];

type Props = {
  waypoint: WaypointRow;
  onSave: (patch: Partial<Pick<WaypointRow, 'name' | 'type' | 'note'>>) => Promise<void>;
  onGoTo: () => void;
  onDelete: () => void;
};

export function WaypointDetailPanel({ waypoint, onSave, onGoTo, onDelete }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [name, setName] = useState(waypoint.name);
  const [note, setNote] = useState(waypoint.note);
  const [type, setType] = useState<WaypointType>(waypoint.type);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setName(waypoint.name);
    setNote(waypoint.note);
    setType(waypoint.type);
    setDirty(false);
  }, [waypoint.id, waypoint.name, waypoint.note, waypoint.type]);

  async function save() {
    await onSave({ name: name.trim() || waypoint.name, note, type });
    setDirty(false);
  }

  return (
    <Card>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {waypoint.name}
      </Text>

      <CoordinateBlock
        latitude={waypoint.latitude}
        longitude={waypoint.longitude}
        onCopied={() => showInfo(t('map.coordsCopied'))}
      />

      <FieldLabel>{t('waypoints.editName')}</FieldLabel>
      <FieldInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setDirty(true);
        }}
        accessibilityLabel={t('waypoints.editName')}
      />

      <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: spacing.md }]}>{t('waypoints.editType')}</Text>
      <View style={styles.chipRow}>
        {WAYPOINT_TYPES.map((wt) => (
          <FilterChip
            key={wt}
            label={t(`waypoints.types.${wt}` as 'waypoints.types.generic')}
            selected={type === wt}
            onPress={() => {
              setType(wt);
              setDirty(true);
            }}
            testID={`waypoints.type.${wt}`}
          />
        ))}
      </View>

      <FieldLabel>{t('waypoints.editNote')}</FieldLabel>
      <FieldInput
        value={note}
        onChangeText={(v) => {
          setNote(v);
          setDirty(true);
        }}
        accessibilityLabel={t('waypoints.editNote')}
      />

      <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.lg }]}>
        {dirty ? <Button label={t('common.save')} onPress={() => void save()} testID="waypoints.save" /> : null}
        <Button label={t('waypoints.goTo')} onPress={onGoTo} testID="waypoints.goTo" />
        <Button label={t('waypoints.delete')} variant="danger" onPress={onDelete} testID="waypoints.delete" style={{ minHeight: minTouch }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  groupLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  actions: {},
});
