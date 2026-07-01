import { useMemo } from 'react';
import { Pressable, Text } from 'react-native';

import { computeLiveTrailDistanceNm } from '../../lib/geo/pathDistance';
import { distanceUnitLabel, formatDistanceNm } from '../../lib/geo/units';
import { t } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrackStore } from '../../store/trackStore';
import { useTheme } from '../../theme/ThemeContext';
import { touchChipStyle, touchChipText } from '../../ui/chipTokens';

type Props = {
  onOpenTracks: () => void;
};

/** Optional map chip — live recording distance; tap opens the Tracks tab. */
export function MapRecordingChip({ onOpenTracks }: Props) {
  const { colors, minTouch } = useTheme();
  const enabled = useSettingsStore((s) => s.mapShowRecordingDistance);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const recordingTrackId = useTrackStore((s) => s.recordingTrackId);
  const liveTrail = useTrackStore((s) => s.liveTrail);

  const distanceNm = useMemo(() => computeLiveTrailDistanceNm(liveTrail), [liveTrail]);
  const unitLabel = distanceUnitLabel(distanceUnit);
  const distanceText = formatDistanceNm(distanceNm, distanceUnit);

  if (!enabled || !recordingTrackId) return null;

  const label = t('tracks.recordingMapChip', { distance: distanceText, unit: unitLabel });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('tracks.recordingMapChipA11y', { distance: distanceText, unit: unitLabel })}
      accessibilityHint={t('tracks.recordingMapChipHint')}
      onPress={onOpenTracks}
      style={[
        touchChipStyle(minTouch, {
          borderColor: colors.warningBorder,
          backgroundColor: colors.warningBg,
        }),
      ]}
      testID="map.recordingChip"
    >
      <Text style={[touchChipText, { color: colors.warningText }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
