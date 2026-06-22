import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFormFactor } from '../../hooks/useFormFactor';
import { t } from '../../i18n';
import { LAYOUT_PRESETS, ACTIVITY_PROFILES, getActivityProfile } from '../../settings/profiles';
import type { LayoutPreset } from '../../settings/defaults';
import { StartLineSection } from '../racing/StartLineSection';
import { RacePackSection } from '../racing/RacePackSection';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { FilterChip } from '../../ui/FilterChip';

const MOB_HOLD_MS = 2000;

type Props = {
  showRangeRings: boolean;
  onToggleRangeRings: () => void;
};

export function MapChrome({ showRangeRings, onToggleRangeRings }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const insets = useSafeAreaInsets();
  const { formFactor } = useFormFactor();
  const fix = useLocationStore((s) => s.fix);
  const layoutPreset = useSettingsStore((s) => s.layoutPreset);
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const dropMob = useNavigationStore((s) => s.dropMob);
  const createWaypoint = useWaypointStore((s) => s.create);
  const waypoints = useWaypointStore((s) => s.items);
  const setAnchorAlarm = useNavigationStore((s) => s.setAnchorAlarm);
  const clearAnchorAlarm = useNavigationStore((s) => s.clearAnchorAlarm);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const screenLocked = useNavigationStore((s) => s.screenLocked);
  const setScreenLocked = useNavigationStore((s) => s.setScreenLocked);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobProgress, setMobProgress] = useState(0);
  const mobTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mobStart = useRef<number | null>(null);

  const clearMobTimer = useCallback(() => {
    if (mobTimer.current) clearInterval(mobTimer.current);
    mobTimer.current = null;
    mobStart.current = null;
    setMobProgress(0);
  }, []);

  const onMobPressIn = useCallback(() => {
    mobStart.current = Date.now();
    mobTimer.current = setInterval(() => {
      if (!mobStart.current) return;
      const elapsed = Date.now() - mobStart.current;
      setMobProgress(Math.min(1, elapsed / MOB_HOLD_MS));
      if (elapsed >= MOB_HOLD_MS) {
        clearMobTimer();
        if (fix) {
          void dropMob(fix.latitude, fix.longitude).then(() =>
            createWaypoint({ name: t('waypoints.types.mob'), latitude: fix.latitude, longitude: fix.longitude, type: 'mob' }),
          );
          Alert.alert(t('map.mobDroppedTitle'), t('map.mobDroppedBody'));
        } else {
          Alert.alert(t('map.mobNoGpsTitle'), t('map.mobNoGpsBody'));
        }
      }
    }, 50);
  }, [clearMobTimer, dropMob, createWaypoint, fix]);

  const onMobPressOut = useCallback(() => {
    clearMobTimer();
  }, [clearMobTimer]);

  async function applyProfile(profileId: string) {
    const profile = getActivityProfile(profileId);
    if (!profile) return;
    await patchSettings({
      activityProfileId: profileId,
      layoutPreset: profile.defaultLayout,
      sogUnit: profile.sogUnit,
      distanceUnit: profile.distanceUnit,
    });
  }

  async function applyLayout(preset: LayoutPreset) {
    await patchSettings({ layoutPreset: preset });
  }

  function toggleAnchor() {
    if (anchorAlarm?.active) {
      Alert.alert(t('map.anchorClearTitle'), t('map.anchorClearBody'), [
        { text: t('common.dismiss'), style: 'cancel' },
        { text: t('map.anchorClearConfirm'), style: 'destructive', onPress: () => void clearAnchorAlarm() },
      ]);
      return;
    }
    if (!fix) {
      Alert.alert(t('map.anchorNoGpsTitle'), t('map.anchorNoGpsBody'));
      return;
    }
    void setAnchorAlarm(fix.latitude, fix.longitude, 0.05);
    Alert.alert(t('map.anchorSetTitle'), t('map.anchorSetBody', { nm: '0.05' }));
  }

  const bottomOffset = formFactor === 'compact' ? insets.bottom + 150 : insets.bottom + 12;

  return (
    <>
      <View pointerEvents="box-none" style={[styles.actions, { bottom: bottomOffset, right: 12 + insets.right }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.quickSwitch')}
          onPress={() => setSheetOpen(true)}
          style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: minTouch, minWidth: minTouch }]}
          testID="map.quickSwitch"
        >
          <Text style={[styles.actionText, { color: colors.text }]}>{t('map.quickSwitchShort')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.anchorAlarm')}
          accessibilityState={{ selected: Boolean(anchorAlarm?.active) }}
          onPress={toggleAnchor}
          style={[styles.actionBtn, { backgroundColor: anchorAlarm?.active ? colors.successBg : colors.surface, borderColor: colors.border, minHeight: minTouch, minWidth: minTouch }]}
          testID="map.anchor"
        >
          <Text style={[styles.actionText, { color: anchorAlarm?.active ? colors.success : colors.text }]}>{t('map.anchorShort')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.mobHold')}
          accessibilityHint={t('map.mobHoldHint')}
          onPressIn={onMobPressIn}
          onPressOut={onMobPressOut}
          style={[styles.actionBtn, styles.mobBtn, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder, minHeight: minTouch, minWidth: minTouch }]}
          testID="map.mob"
        >
          <Text style={[styles.actionText, { color: colors.danger }]}>{t('map.mobShort')}</Text>
          {mobProgress > 0 ? (
            <View style={[styles.mobProgress, { width: `${mobProgress * 100}%`, backgroundColor: colors.danger }]} />
          ) : null}
        </Pressable>
      </View>

      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSheetOpen(false)} accessibilityLabel={t('common.dismiss')}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('map.quickSwitch')}</Text>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('map.profileLabel')}</Text>
            <View style={styles.chipRow}>
              {ACTIVITY_PROFILES.map((p) => (
                <FilterChip
                  key={p.id}
                  label={t(p.labelKey as 'profiles.cruisePassage')}
                  selected={activityProfileId === p.id}
                  onPress={() => void applyProfile(p.id)}
                  testID={`map.profile.${p.id}`}
                />
              ))}
            </View>
            <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: spacing.lg }]}>{t('map.layoutLabel')}</Text>
            <View style={styles.chipRow}>
              {LAYOUT_PRESETS.map((preset) => (
                <FilterChip
                  key={preset}
                  label={t(`map.layouts.${preset}` as 'map.layouts.map-forward')}
                  selected={layoutPreset === preset}
                  onPress={() => void applyLayout(preset)}
                  testID={`map.layout.${preset}`}
                />
              ))}
            </View>
            <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: spacing.lg }]}>{t('map.extrasLabel')}</Text>
            <View style={styles.chipRow}>
              <FilterChip label={t('map.rangeRings')} selected={showRangeRings} onPress={onToggleRangeRings} testID="map.rangeRings" />
              <FilterChip
                label={t('map.screenLock')}
                selected={screenLocked}
                onPress={() => void setScreenLocked(!screenLocked)}
                testID="map.screenLock"
              />
            </View>
            {activityProfileId === 'sailing-race' ? <StartLineSection waypoints={waypoints} /> : null}
            {activityProfileId === 'sailing-race' ? <RacePackSection /> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => setSheetOpen(false)}
              style={[styles.closeBtn, { minHeight: minTouch, borderColor: colors.border }]}
              testID="map.sheetClose"
            >
              <Text style={[styles.closeText, { color: colors.primary }]}>{t('common.dismiss')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {screenLocked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.unlockScreen')}
          onPress={() => void setScreenLocked(false)}
          style={[styles.lockOverlay, { backgroundColor: `${colors.background}E6` }]}
          testID="map.screenLockOverlay"
        >
          <Text style={[styles.lockText, { color: colors.text }]}>{t('map.screenLocked')}</Text>
          <Text style={[styles.lockHint, { color: colors.textMuted }]}>{t('map.unlockScreen')}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { position: 'absolute', gap: 8, alignItems: 'flex-end' },
  actionBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  mobBtn: { position: 'relative' },
  mobProgress: { position: 'absolute', bottom: 0, left: 0, height: 4, opacity: 0.8 },
  actionText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 20, maxHeight: '80%' },
  sheetTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  groupLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  closeBtn: { marginTop: 20, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, fontWeight: '700' },
  lockOverlay: { ...StyleSheet.absoluteFill, zIndex: 50, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lockText: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  lockHint: { fontSize: 16, textAlign: 'center' },
});
