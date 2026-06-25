import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TrackPointRow, TrackRow } from '../../lib/db/database';
import { computePathDistanceNm } from '../../lib/geo/pathDistance';
import { formatDistanceNm } from '../../lib/geo/units';
import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Screen';
import { StatusBadge } from '../../ui/StatusBadge';

type Props = {
  track: TrackRow;
  points: TrackPointRow[];
  onExport: () => void;
  onDelete: () => void;
  onShowOnMap?: () => void;
  showingOnMap?: boolean;
};

function formatDurationMs(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

export function TrackDetailPanel({ track, points, onExport, onDelete, onShowOnMap, showingOnMap }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const [distanceNmTotal, setDistanceNmTotal] = useState(0);

  useEffect(() => {
    setDistanceNmTotal(computePathDistanceNm(points));
  }, [points]);

  const endedAt = track.ended_at ?? Date.now();
  const duration = formatDurationMs(endedAt - track.started_at);

  return (
    <Card>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {track.name}
      </Text>
      <View style={[styles.badges, { gap: spacing.sm, marginBottom: spacing.md }]}>
        {track.ended_at ? (
          <StatusBadge label={t('tracks.completed')} variant="success" />
        ) : (
          <StatusBadge label={t('tracks.open')} variant="warning" />
        )}
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]}>{t('tracks.detailStarted', { when: new Date(track.started_at).toLocaleString() })}</Text>
      {track.ended_at ? (
        <Text style={[styles.meta, { color: colors.textMuted }]}>{t('tracks.detailEnded', { when: new Date(track.ended_at).toLocaleString() })}</Text>
      ) : null}
      <View style={[styles.stats, { marginTop: spacing.md, gap: spacing.sm }]}>
        <Stat label={t('tracks.detailPoints')} value={String(points.length)} colors={colors} />
        <Stat label={t('tracks.detailDuration')} value={duration} colors={colors} />
        <Stat label={t('tracks.detailDistance')} value={`${formatDistanceNm(distanceNmTotal, distanceUnit)} ${distanceUnit}`} colors={colors} />
      </View>
      <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.lg }]}>
        {onShowOnMap && points.length >= 2 ? (
          <Button
            label={showingOnMap ? t('tracks.previewOnMapActive') : t('tracks.showOnMap')}
            onPress={onShowOnMap}
            testID="tracks.detail.showOnMap"
          />
        ) : null}
        <Button label={t('tracks.exportGpx')} variant="secondary" onPress={onExport} testID="tracks.detail.export" disabled={points.length === 0} />
        <Button label={t('tracks.delete')} variant="danger" onPress={onDelete} testID="tracks.detail.delete" style={{ minHeight: minTouch }} />
      </View>
    </Card>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: { text: string; textMuted: string } }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  meta: { fontSize: 14, lineHeight: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap' },
  stats: {},
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 },
  statLabel: { fontSize: 14, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '700' },
  actions: {},
});
