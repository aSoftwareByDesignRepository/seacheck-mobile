import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBatteryLevel } from '../../hooks/useBatteryLevel';
import { useFixAge } from '../../hooks/useFixAge';
import { getAnchorWatchStatus } from '../../lib/anchor/activateAnchorAlarm';
import { openSystemSettings } from '../../lib/permissions/locationPermissions';
import { t } from '../../i18n';
import { useNavigationStore } from '../../store/navigationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  onOpenSettings?: () => void;
  showRecenter?: boolean;
  onRecenter?: () => void;
  /** Inside horizontal scroll — no outer margin, chips stay on one row. */
  compact?: boolean;
};

export function GpsStatusStrip({ onOpenSettings, showRecenter = false, onRecenter, compact = false }: Props) {
  const { colors, minTouch } = useTheme();
  const keepAwake = useSettingsStore((s) => s.keepAwakeUnderway);
  const followMode = useSettingsStore((s) => s.followMode);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
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
  if (!showGps && !showBattery && !showAnchorLimited && !showBatteryRestricted && !anchorGpsSuspended && !showRecenter) {
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
      void openSystemSettings();
      return;
    }
    onOpenSettings?.();
  }

  return (
    <View style={[styles.row, compact ? styles.rowCompact : null]} testID="map.gpsStatus">
      {showRecenter ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.recenter')}
          accessibilityHint={t('map.recenterHint')}
          onPress={onRecenter}
          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.primary, minHeight: minTouch }]}
          testID="map.recenter"
        >
          <Text style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>
            {t('map.recenterChip')}
          </Text>
        </Pressable>
      ) : null}
      {showBatteryRestricted ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.batteryOptimizationChip')}
          onPress={onOpenSettings}
          style={[styles.chip, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder, minHeight: minTouch }]}
          testID="map.gpsStatus.batteryOpt"
        >
          <Text style={[styles.chipText, { color: colors.warningText }]} numberOfLines={1}>
            {t('map.batteryOptimizationShort')}
          </Text>
        </Pressable>
      ) : null}
      {showAnchorLimited ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.anchorWatchLimitedChip')}
          onPress={onOpenSettings}
          style={[styles.chip, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder, minHeight: minTouch }]}
          testID="map.gpsStatus.anchorLimited"
        >
          <Text style={[styles.chipText, { color: colors.warningText }]} numberOfLines={1}>
            {t('map.anchorWatchLimitedShort')}
          </Text>
        </Pressable>
      ) : null}
      {showGps || anchorGpsSuspended ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={gpsLabel}
          accessibilityHint={permissionDenied ? t('permissions.openSettings') : undefined}
          onPress={onGpsPress}
          style={[styles.chip, { backgroundColor: gpsPalette.bg, borderColor: gpsPalette.border, minHeight: minTouch }]}
          testID="map.gpsStatus.gps"
        >
          <Text style={[styles.chipText, { color: gpsPalette.text }]} numberOfLines={1}>
            {gpsLabel}
          </Text>
        </Pressable>
      ) : null}
      {showBattery ? (
        <View
          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: minTouch }]}
          accessibilityLabel={t('map.batteryLevel', { pct: batteryPct })}
          testID="map.gpsStatus.battery"
        >
          <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
            {t('map.batteryLevel', { pct: batteryPct })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  rowCompact: { flexWrap: 'nowrap', marginBottom: 0, gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    flexShrink: 0,
    maxWidth: 280,
  },
  chipText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
});
