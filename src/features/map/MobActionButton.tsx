import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import type { SafetyActionsMetrics } from './mapSafetyActionsLayout';
import { useMobDropHold } from './useMobDropHold';

export { MOB_HOLD_MS } from './useMobDropHold';

type Props = {
  onMobDropped?: () => void;
  testID?: string;
  metrics: SafetyActionsMetrics;
};

/** Hold-to-drop MOB — shared by map action stack and screen-lock overlay. */
export function MobActionButton({ onMobDropped, testID = 'map.mob', metrics }: Props) {
  const { colors } = useTheme();
  const { mobProgress, onMobPressIn, onMobPressOut } = useMobDropHold({ onDropped: onMobDropped });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('map.mobHold')}
      accessibilityHint={t('map.mobHoldHint')}
      accessibilityValue={mobProgress > 0 ? { text: `${Math.round(mobProgress * 100)}%` } : undefined}
      onPressIn={onMobPressIn}
      onPressOut={onMobPressOut}
      style={[
        styles.actionBtn,
        styles.mobBtn,
        {
          backgroundColor: colors.dangerBg,
          borderColor: colors.dangerBorder,
          borderRadius: metrics.borderRadius,
          paddingHorizontal: metrics.paddingH,
          paddingVertical: metrics.paddingV,
          minHeight: metrics.buttonSize,
          minWidth: metrics.buttonSize,
        },
      ]}
      testID={testID}
    >
      <MaterialIcons name="sos" size={metrics.iconSize} color={colors.danger} importantForAccessibility="no" />
      <Text
        style={[styles.caption, { color: colors.danger, fontSize: metrics.captionSize }]}
        importantForAccessibility="no"
      >
        {t('map.mobShort')}
      </Text>
      {mobProgress > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.mobProgress, { width: `${mobProgress * 100}%`, backgroundColor: colors.danger }]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    elevation: 3,
    overflow: 'hidden',
  },
  caption: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 13 },
  mobBtn: {},
  mobProgress: { position: 'absolute', left: 0, bottom: 0, height: 4, opacity: 0.9 },
});
