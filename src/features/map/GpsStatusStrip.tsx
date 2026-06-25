import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBatteryLevel } from '../../hooks/useBatteryLevel';
import { useFixAge } from '../../hooks/useFixAge';
import { getAnchorWatchStatus } from '../../lib/anchor/activateAnchorAlarm';
import { MAX_ALARM_ACCURACY_M } from '../../lib/geo/fixQuality';
import { openSystemSettings, requestForegroundLocationAccess } from '../../lib/permissions/locationPermissions';
import { t } from '../../i18n';
import { useNavigationStore } from '../../store/navigationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useLocationStore } from '../../services/locationService';
import { useTheme } from '../../theme/ThemeContext';
import { chipRow, touchChipStyle, touchChipText } from '../../ui/chipTokens';

type Props = {
  onOpenSettings?: () => void;
  showRecenter?: boolean;
  onRecenter?: () => void;
  /** Inside horizontal scroll — chips stay on one row and scroll when needed. */
  compact?: boolean;
};

export function GpsStatusStrip({ onOpenSettings, showRecenter = false, onRecenter, compact = false }: Props) {
  const { colors, minTouch } = useTheme();
  const keepAwake = useSettingsStore((s) => s.keepAwakeUnderway);
  const followMode = useSettingsStore((s) => s.followMode);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const fix = useLocationStore((s) => s.fix);
  const fixAcceptance = useLocationStore((s) => s.fixAcceptance);
  const permission = useLocationStore((s) => s.permission);
  const foregroundCanAskAgain = useLocationStore((s) => s.foregroundCanAskAgain);
  const { ageSec, isAging, isStale, permissionDenied } = useFixAge();
  const batteryPct = useBatteryLevel(keepAwake && followMode);
  const [anchorWatchLimited, setAnchorWatchLimited] = useState(false);
  const [batteryRestricted, setBatteryRestricted] = useState(false);

  useEffect(() => {
    if (!anchorAlarm?.active) {
      setAnchorWatchLimited(false);
      setBatteryRestricted(false);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      void getAnchorWatchStatus().then((status) => {
        if (!cancelled) {
          setAnchorWatchLimited(status.limited);
          setBatteryRestricted(status.batteryOptimizationRestricted);
        }
      });
    };
    refresh();
    const interval = setInterval(refresh, 8_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [anchorAlarm?.active]);

  const anchorGpsSuspended = Boolean(anchorAlarm?.active && (permissionDenied || isStale));
  const showGps = permissionDenied || isAging || isStale;
  const showBattery = keepAwake && followMode && batteryPct != null;
  const showAnchorLimited = anchorAlarm?.active && anchorWatchLimited;
  const showBatteryRestricted = anchorAlarm?.active && batteryRestricted;

  const accuracyM = fix?.accuracyM != null && Number.isFinite(fix.accuracyM) ? Math.round(fix.accuracyM) : null;
  const showOutlier = fixAcceptance === 'outlier' && !isStale && !permissionDenied;
  const showPoorAccuracy =
    fixAcceptance === 'poor_accuracy' || (accuracyM != null && accuracyM > MAX_ALARM_ACCURACY_M);
  const showAccuracyChip =
    !permissionDenied &&
    !isStale &&
    !showOutlier &&
    accuracyM != null &&
    (accuracyM > 30 || fixAcceptance === 'poor_accuracy');
  const showAccuracyGood =
    !permissionDenied && !isStale && !showOutlier && accuracyM != null && accuracyM <= 30 && !showPoorAccuracy;

  if (
    !showGps &&
    !showBattery &&
    !showAnchorLimited &&
    !showBatteryRestricted &&
    !anchorGpsSuspended &&
    !showRecenter &&
    !showOutlier &&
    !showAccuracyChip &&
    !showAccuracyGood
  ) {
    return null;
  }

  const gpsPalette = permissionDenied || isStale
    ? { bg: colors.dangerBg, border: colors.dangerBorder, text: colors.danger }
    : { bg: colors.warningBg, border: colors.warningBorder, text: colors.warningText };

  const gpsLabel = permissionDenied
    ? t('map.gpsDeniedShort')
    : anchorGpsSuspended && anchorAlarm?.active
      ? t('map.anchorGpsSuspendedShort')
      : isStale
        ? t('map.gpsStaleShort')
        : t('map.fixAge', { sec: ageSec ?? 0 });

  function onGpsPress() {
    if (permissionDenied) {
      if (foregroundCanAskAgain) {
        void requestForegroundLocationAccess();
      } else {
        void openSystemSettings();
      }
      return;
    }
    if (permission === 'undetermined') {
      void requestForegroundLocationAccess();
      return;
    }
    onOpenSettings?.();
  }

  function chipColors(bg: string, border: string) {
    return touchChipStyle(minTouch, { backgroundColor: bg, borderColor: border });
  }

  return (
    <View style={[compact ? chipRow.rowScroll : chipRow.row, !compact ? styles.rowSpaced : null]} testID="map.gpsStatus">
      {showRecenter ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.recenter')}
          accessibilityHint={t('map.recenterHint')}
          onPress={onRecenter}
          style={chipColors(colors.surface, colors.primary)}
          testID="map.recenter"
        >
          <Text style={[touchChipText, { color: colors.primary }]}>{t('map.recenterChip')}</Text>
        </Pressable>
      ) : null}
      {showBatteryRestricted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.batteryOptimizationChip')}
          onPress={onOpenSettings}
          style={chipColors(colors.warningBg, colors.warningBorder)}
          testID="map.gpsStatus.batteryOpt"
        >
          <Text style={[touchChipText, { color: colors.warningText }]}>{t('map.batteryOptimizationShort')}</Text>
        </Pressable>
      ) : null}
      {showAnchorLimited ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.anchorWatchLimitedChip')}
          onPress={onOpenSettings}
          style={chipColors(colors.warningBg, colors.warningBorder)}
          testID="map.gpsStatus.anchorLimited"
        >
          <Text style={[touchChipText, { color: colors.warningText }]}>{t('map.anchorWatchLimitedShort')}</Text>
        </Pressable>
      ) : null}
      {showOutlier ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.gpsOutlierChip')}
          accessibilityHint={t('map.gpsOutlierHint')}
          onPress={onOpenSettings}
          style={chipColors(colors.warningBg, colors.warningBorder)}
          testID="map.gpsStatus.outlier"
        >
          <Text style={[touchChipText, { color: colors.warningText }]}>{t('map.gpsOutlierShort')}</Text>
        </Pressable>
      ) : null}
      {showAccuracyGood ? (
        <View
          style={chipColors(colors.surface, colors.border)}
          accessibilityLabel={t('map.gpsAccuracyGood', { m: accuracyM })}
          testID="map.gpsStatus.accuracy"
        >
          <Text style={[touchChipText, { color: colors.text }]}>{t('map.gpsAccuracyShort', { m: accuracyM })}</Text>
        </View>
      ) : null}
      {showAccuracyChip && !showAccuracyGood ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.gpsAccuracyWarn', { m: accuracyM ?? '—' })}
          onPress={onOpenSettings}
          style={chipColors(colors.warningBg, colors.warningBorder)}
          testID="map.gpsStatus.accuracy"
        >
          <Text style={[touchChipText, { color: colors.warningText }]}>
            {t('map.gpsAccuracyShort', { m: accuracyM ?? '—' })}
          </Text>
        </Pressable>
      ) : null}
      {showGps || anchorGpsSuspended ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={gpsLabel}
          accessibilityHint={permissionDenied ? t('permissions.openSettings') : undefined}
          onPress={onGpsPress}
          style={chipColors(gpsPalette.bg, gpsPalette.border)}
          testID="map.gpsStatus.gps"
        >
          <Text style={[touchChipText, { color: gpsPalette.text }]}>{gpsLabel}</Text>
        </Pressable>
      ) : null}
      {showBattery ? (
        <View
          style={chipColors(colors.surface, colors.border)}
          accessibilityLabel={t('map.batteryLevel', { pct: batteryPct })}
          testID="map.gpsStatus.battery"
        >
          <Text style={[touchChipText, { color: colors.text }]}>{t('map.batteryLevel', { pct: batteryPct })}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowSpaced: { marginBottom: 8 },
});
