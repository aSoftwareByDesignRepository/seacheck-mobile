import type { ReactNode } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSafetyActionsMetrics } from '../../hooks/useSafetyActionsMetrics';
import { activateAnchorAlarmAt } from '../../lib/anchor/activateAnchorAlarm';
import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { isSafetyFixOk } from '../../lib/geo/fixQuality';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { ActionSheet } from '../../ui/ActionSheet';
import type { SafetyActionsVariant } from './mapSafetyActionsLayout';
import { MobActionButton } from './MobActionButton';

type Props = {
  onMobDropped?: () => void;
  showAnchor?: boolean;
  /** Side column on map edge, or compact stack when embedded in a dock (instruments-only chart overlay fallback). */
  variant?: SafetyActionsVariant;
};

/**
 * Screen lock, anchor watch, and MOB — icon buttons with short captions.
 * Full labels on accessibilityLabel for WCAG 2.1 AA.
 */
export function MapActions({ onMobDropped, showAnchor = true, variant = 'side' }: Props) {
  const { colors, minTouch } = useTheme();
  const metrics = useSafetyActionsMetrics(variant, showAnchor);
  const fix = useLocationStore((s) => s.fix);
  const anchorRadiusNm = useSettingsStore((s) => s.anchorRadiusNm);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const showError = useFeedbackStore((s) => s.showError);
  const clearAnchorAlarm = useNavigationStore((s) => s.clearAnchorAlarm);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const setScreenLocked = useNavigationStore((s) => s.setScreenLocked);

  const [anchorClearOpen, setAnchorClearOpen] = useState(false);

  async function activateAnchorAlarm() {
    if (!fix || !isSafetyFixOk(fix)) {
      showError(t('map.anchorNoGpsBody'));
      return;
    }
    await activateAnchorAlarmAt(fix.latitude, fix.longitude, anchorRadiusNm);
  }

  async function toggleAnchor() {
    if (anchorAlarm?.active) {
      setAnchorClearOpen(true);
      return;
    }
    void activateAnchorAlarm();
  }

  async function engageScreenLock() {
    setAnchorClearOpen(false);
    await setScreenLocked(true);
  }

  const touchSize = Math.max(metrics.buttonSize, minTouch);
  const btnStyle = {
    borderRadius: metrics.borderRadius,
    paddingHorizontal: metrics.paddingH,
    paddingVertical: metrics.paddingV,
    minHeight: touchSize,
    minWidth: touchSize,
    ...(variant === 'inline' ? { flex: 1 } : null),
  };

  return (
    <>
      <View
        style={[variant === 'inline' ? styles.row : styles.column, { gap: metrics.gap }]}
        pointerEvents="box-none"
        testID="map.safetyActions"
      >
        <SafetyAction
          accessibilityLabel={t('map.screenLock')}
          accessibilityHint={t('map.screenLockHint')}
          onPress={() => void engageScreenLock()}
          testID="map.screenLock"
          borderColor={colors.border}
          backgroundColor={colors.surface}
          btnStyle={btnStyle}
        >
          <MaterialIcons name="lock" size={metrics.iconSize} color={colors.text} importantForAccessibility="no" />
          <Text
            style={[styles.caption, { color: colors.textMuted, fontSize: metrics.captionSize }]}
            importantForAccessibility="no"
          >
            {t('map.screenLockShort')}
          </Text>
        </SafetyAction>
        {showAnchor ? (
          <SafetyAction
            accessibilityLabel={t('map.anchorAlarm')}
            accessibilityHint={t('map.anchorWatchMonitoringHint')}
            accessibilityState={{ selected: Boolean(anchorAlarm?.active) }}
            onPress={() => void toggleAnchor()}
            testID="map.anchor"
            borderColor={anchorAlarm?.active ? colors.success : colors.border}
            backgroundColor={anchorAlarm?.active ? colors.successBg : colors.surface}
            btnStyle={btnStyle}
          >
            <MaterialIcons
              name="anchor"
              size={metrics.iconSize}
              color={anchorAlarm?.active ? colors.success : colors.text}
              importantForAccessibility="no"
            />
            <Text
              style={[
                styles.caption,
                { color: anchorAlarm?.active ? colors.success : colors.textMuted, fontSize: metrics.captionSize },
              ]}
              importantForAccessibility="no"
            >
              {t('map.anchorShort')}
            </Text>
          </SafetyAction>
        ) : null}
        <MobActionButton onMobDropped={onMobDropped} metrics={metrics} />
      </View>

      <ActionSheet
        visible={anchorClearOpen}
        onClose={() => setAnchorClearOpen(false)}
        title={t('map.anchorClearTitle')}
        message={t('map.anchorClearBody', {
          value: formatDistanceNm(anchorAlarm?.radiusNm ?? anchorRadiusNm, distanceUnit, 2),
          unit: distanceUnitLabel(distanceUnit),
        })}
        options={[
          {
            label: t('map.anchorClearConfirm'),
            destructive: true,
            onPress: () => void clearAnchorAlarm(),
            testID: 'map.anchorClearConfirm',
          },
          {
            label: t('common.dismiss'),
            onPress: () => {},
            testID: 'map.anchorClearCancel',
          },
        ]}
        testID="map.anchorClear"
      />
    </>
  );
}

function SafetyAction({
  children,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  borderColor,
  backgroundColor,
  btnStyle,
}: {
  children: ReactNode;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityState?: { selected?: boolean };
  borderColor: string;
  backgroundColor: string;
  btnStyle: {
    borderRadius: number;
    paddingHorizontal: number;
    paddingVertical: number;
    minHeight: number;
    minWidth: number;
  };
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={[styles.actionBtn, btnStyle, { borderColor, backgroundColor }]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { flexDirection: 'column', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-evenly', alignSelf: 'stretch' },
  actionBtn: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    elevation: 3,
  },
  caption: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 13 },
});
