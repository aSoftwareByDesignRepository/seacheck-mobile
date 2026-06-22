import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import type { WaypointRow } from '../../lib/db/database';
import { useNavigationStore } from '../../store/navigationStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { FilterChip } from '../../ui/FilterChip';

type Props = {
  waypoints: WaypointRow[];
};

export function StartLineSection({ waypoints }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const startLine = useNavigationStore((s) => s.startLine);
  const setStartLine = useNavigationStore((s) => s.setStartLine);
  const clearStartLine = useNavigationStore((s) => s.clearStartLine);
  const [pinA, setPinA] = useState<string | null>(startLine?.pinAWaypointId ?? null);
  const [pinB, setPinB] = useState<string | null>(startLine?.pinBWaypointId ?? null);

  useEffect(() => {
    setPinA(startLine?.pinAWaypointId ?? null);
    setPinB(startLine?.pinBWaypointId ?? null);
  }, [startLine?.pinAWaypointId, startLine?.pinBWaypointId]);

  function selectPinA(id: string) {
    setPinA(id);
    if (pinB && pinB !== id) void setStartLine(id, pinB);
    else if (pinB === id) setPinB(null);
  }

  function selectPinB(id: string) {
    setPinB(id);
    if (pinA && pinA !== id) void setStartLine(pinA, id);
    else if (pinA === id) setPinA(null);
  }

  if (waypoints.length < 2) {
    return (
      <View style={{ marginTop: spacing.lg }} testID="race.startLine">
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('race.startLineTitle')}</Text>
        <Text style={[styles.hint, { color: colors.textMuted, lineHeight: 20 }]}>{t('race.startLineNeedWaypoints')}</Text>
      </View>
    );
  }

  const ready = Boolean(startLine?.pinAWaypointId && startLine?.pinBWaypointId);

  return (
    <View style={{ marginTop: spacing.lg }} testID="race.startLine">
      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('race.startLineTitle')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('race.startLineBody')}</Text>

      <Text style={[styles.pinLabel, { color: colors.text }]}>{t('race.pinA')}</Text>
      <View style={styles.chipRow}>
        {waypoints.map((wp) => (
          <FilterChip key={`a-${wp.id}`} label={wp.name} selected={pinA === wp.id} onPress={() => selectPinA(wp.id)} testID={`race.pinA.${wp.id}`} />
        ))}
      </View>

      <Text style={[styles.pinLabel, { color: colors.text, marginTop: spacing.sm }]}>{t('race.pinB')}</Text>
      <View style={styles.chipRow}>
        {waypoints.map((wp) => (
          <FilterChip key={`b-${wp.id}`} label={wp.name} selected={pinB === wp.id} onPress={() => selectPinB(wp.id)} testID={`race.pinB.${wp.id}`} />
        ))}
      </View>

      {ready ? (
        <Text style={{ color: colors.success, fontWeight: '700', marginTop: spacing.sm, minHeight: minTouch, textAlignVertical: 'center' }} accessibilityLiveRegion="polite">
          {t('race.startLineReady')}
        </Text>
      ) : (
        <Text style={{ color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 }}>{t('race.startLinePickBoth')}</Text>
      )}

      {startLine ? <Button label={t('race.startLineClear')} variant="secondary" onPress={() => void clearStartLine()} testID="race.startLineClear" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  hint: { fontSize: 14 },
  pinLabel: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
