import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrackStore } from '../../store/trackStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  compact?: boolean;
};

export function MapPreviewTrackBanner({ compact = false }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const mapPreviewTrackId = useTrackStore((s) => s.mapPreviewTrackId);
  const mapPreviewDistanceNm = useTrackStore((s) => s.mapPreviewDistanceNm);
  const tracks = useTrackStore((s) => s.tracks);
  const setMapPreviewTrack = useTrackStore((s) => s.setMapPreviewTrack);

  const track = tracks.find((tr) => tr.id === mapPreviewTrackId);
  if (!mapPreviewTrackId || !track) return null;

  const distanceLabel =
    mapPreviewDistanceNm != null && mapPreviewDistanceNm > 0
      ? t('tracks.previewDistance', {
          distance: formatDistanceNm(mapPreviewDistanceNm, distanceUnit),
          unit: distanceUnitLabel(distanceUnit),
        })
      : null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          marginBottom: compact ? 0 : spacing.sm,
        },
      ]}
      testID="map.trackPreview.banner"
      accessibilityRole="summary"
      accessibilityLabel={
        distanceLabel
          ? `${t('tracks.previewOnMap', { name: track.name })}. ${distanceLabel}`
          : t('tracks.previewOnMap', { name: track.name })
      }
    >
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {t('tracks.previewOnMap', { name: track.name })}
        </Text>
        {distanceLabel ? (
          <Text style={[styles.distance, { color: colors.textMuted }]}>{distanceLabel}</Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tracks.previewClear')}
        onPress={() => void setMapPreviewTrack(null)}
        style={[styles.clearBtn, { minHeight: minTouch, minWidth: minTouch, borderColor: colors.border }]}
        testID="map.trackPreview.clear"
      >
        <Text style={[styles.clearText, { color: colors.primary }]}>{t('tracks.previewClear')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  textBlock: { flex: 1, minWidth: 0 },
  label: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  distance: { fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 2, fontVariant: ['tabular-nums'] },
  clearBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  clearText: { fontSize: 13, fontWeight: '800' },
});
