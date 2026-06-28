import { StyleSheet, Text, View } from 'react-native';

import type { TrackPointRow } from '../../lib/db/database';
import { formatSog } from '../../lib/geo/units';
import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/tokens';
import { BottomSheet, SheetDismissFooter } from '../../ui/BottomSheet';
import { CoordinateBlock } from '../../ui/CoordinateBlock';

type Props = {
  point: TrackPointRow | null;
  trackName?: string;
  onClose: () => void;
  onCopied?: () => void;
};

export function TrackPointMapDetailSheet({ point, trackName, onClose, onCopied }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const sogUnit = useSettingsStore((s) => s.sogUnit);

  if (!point) return null;

  const when = new Date(point.recorded_at).toLocaleString();
  const sogText = point.sog_ms != null ? formatSog(point.sog_ms, sogUnit) : '—';
  const title = trackName ?? t('tracks.previewFallback');

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={t('tracks.pointInspectTitle')}
      subtitle={title}
      testID="trackPoint.sheet"
    >
      <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
        <StatRow label={t('tracks.pointInspectTime')} value={when} colors={colors} minTouch={minTouch} />
        <StatRow label={t('tracks.pointInspectSog')} value={sogText} colors={colors} minTouch={minTouch} />
      </View>
      <CoordinateBlock latitude={point.latitude} longitude={point.longitude} onCopied={onCopied} />
      <View style={{ marginTop: spacing.lg }}>
        <SheetDismissFooter onClose={onClose} testID="trackPoint.dismiss" />
      </View>
    </BottomSheet>
  );
}

function StatRow({
  label,
  value,
  colors,
  minTouch,
}: {
  label: string;
  value: string;
  colors: { text: string; textMuted: string };
  minTouch: number;
}) {
  return (
    <View style={[styles.statRow, { minHeight: minTouch }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  statLabel: { ...typography.caption, fontWeight: '600', flex: 1 },
  statValue: { ...typography.body, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
});
