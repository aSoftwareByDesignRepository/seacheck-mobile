import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useTrackStore } from '../../store/trackStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  compact?: boolean;
};

export function MapPreviewTrackBanner({ compact = false }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const mapPreviewTrackId = useTrackStore((s) => s.mapPreviewTrackId);
  const tracks = useTrackStore((s) => s.tracks);
  const setMapPreviewTrack = useTrackStore((s) => s.setMapPreviewTrack);

  const track = tracks.find((tr) => tr.id === mapPreviewTrackId);
  if (!mapPreviewTrackId || !track) return null;

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
    >
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {t('tracks.previewOnMap', { name: track.name })}
      </Text>
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
  label: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  clearBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  clearText: { fontSize: 13, fontWeight: '800' },
});
