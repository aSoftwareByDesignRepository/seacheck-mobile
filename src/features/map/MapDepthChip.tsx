import { Pressable, Text } from 'react-native';

import { t } from '../../i18n';
import { useOnlineLayersAllowed } from '../../lib/network/connectivity';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { touchChipStyle, touchChipText } from '../../ui/chipTokens';

type Props = {
  onOpenDepthSettings: () => void;
};

/**
 * Shows when the user enabled depth contours — reminds that depths are unofficial
 * and opens Map settings (Chart & data) to turn the overlay off.
 */
export function MapDepthChip({ onOpenDepthSettings }: Props) {
  const { colors, minTouch } = useTheme();
  const enabled = useSettingsStore((s) => s.mapShowDepthOverlay);
  const onlineLayersAllowed = useOnlineLayersAllowed();

  if (!enabled) return null;

  const offline = !onlineLayersAllowed;
  const label = offline ? t('map.depthChipOffline') : t('map.depthChip');
  const a11y = offline ? t('map.depthChipOfflineA11y') : t('map.depthChipA11y');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={t('map.depthChipHint')}
      onPress={onOpenDepthSettings}
      style={[
        touchChipStyle(minTouch, {
          borderColor: offline ? colors.warningBorder : colors.border,
          backgroundColor: offline ? colors.warningBg : colors.surface,
        }),
      ]}
      testID="map.depthChip"
    >
      <Text
        style={[touchChipText, { color: offline ? colors.warningText : colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
