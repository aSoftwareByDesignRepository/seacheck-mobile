import * as Clipboard from 'expo-clipboard';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { activateAnchorAlarmAt } from '../../lib/anchor/activateAnchorAlarm';
import { COURSE_VECTOR_MINUTE_OPTIONS } from '../../lib/settings/mapSettings';
import { isFixQualityOk } from '../../lib/geo/fixQuality';
import { buildMaydayMessage } from '../../lib/emergency/maydayMessage';
import { t } from '../../i18n';
import { StartLineSection } from '../racing/StartLineSection';
import { RacePackSection } from '../racing/RacePackSection';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useWaypointStore } from '../../store/waypointStore';
import { useTheme } from '../../theme/ThemeContext';
import { BottomSheet } from '../../ui/BottomSheet';
import { ActionSheet } from '../../ui/ActionSheet';
import { FilterChip } from '../../ui/FilterChip';
import { SheetSection } from '../../ui/SheetSection';

const MOB_HOLD_MS = 2000;

type Props = {
  showRangeRings: boolean;
  onToggleRangeRings: () => void;
  /** When set, buttons render inline (minimal dock). Otherwise caller positions the column. */
  inline?: boolean;
};

export function MapActions({
  showRangeRings,
  onToggleRangeRings,
  inline = false,
}: Props) {
  const { colors, minTouch } = useTheme();
  const fix = useLocationStore((s) => s.fix);
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);
  const mapShowCourseVector = useSettingsStore((s) => s.mapShowCourseVector);
  const mapCourseVectorMinutes = useSettingsStore((s) => s.mapCourseVectorMinutes);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const vessel = useSettingsStore((s) => s.vessel);
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const showError = useFeedbackStore((s) => s.showError);
  const dropMob = useNavigationStore((s) => s.dropMob);
  const createWaypoint = useWaypointStore((s) => s.create);
  const waypoints = useWaypointStore((s) => s.items);
  const clearAnchorAlarm = useNavigationStore((s) => s.clearAnchorAlarm);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const setScreenLocked = useNavigationStore((s) => s.setScreenLocked);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [anchorClearOpen, setAnchorClearOpen] = useState(false);
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
        if (fix && isFixQualityOk(fix)) {
          void dropMob(fix.latitude, fix.longitude).then(() =>
            createWaypoint({ name: t('waypoints.types.mob'), latitude: fix.latitude, longitude: fix.longitude, type: 'mob' }),
          );
          showSuccess(t('map.mobDroppedBody'));
        } else {
          showError(t('map.mobNoGpsBody'));
        }
      }
    }, 50);
  }, [clearMobTimer, dropMob, createWaypoint, fix, showError, showSuccess]);

  const onMobPressOut = useCallback(() => {
    clearMobTimer();
  }, [clearMobTimer]);

  async function copyEmergencyMessage() {
    const posFix = fix ?? useLocationStore.getState().lastGoodFix;
    const text = buildMaydayMessage(vessel, posFix, coordFormat);
    await Clipboard.setStringAsync(text);
    showInfo(t('settings.emergencyCopy'));
  }

  async function activateAnchorAlarm() {
    if (!fix || !isFixQualityOk(fix)) {
      showError(t('map.anchorNoGpsBody'));
      return;
    }
    await activateAnchorAlarmAt(fix.latitude, fix.longitude);
  }

  async function toggleAnchor() {
    if (anchorAlarm?.active) {
      setAnchorClearOpen(true);
      return;
    }
    void activateAnchorAlarm();
  }

  const buttons = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('map.mapTools')}
        onPress={() => setSheetOpen(true)}
        style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, minHeight: minTouch, minWidth: minTouch }]}
        testID="map.quickSwitch"
      >
        <Text style={[styles.actionText, { color: colors.text }]}>{t('map.mapToolsShort')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('map.anchorAlarm')}
        accessibilityState={{ selected: Boolean(anchorAlarm?.active) }}
        onPress={() => void toggleAnchor()}
        style={[styles.actionBtn, { backgroundColor: anchorAlarm?.active ? colors.successBg : colors.surface, borderColor: colors.border, minHeight: minTouch, minWidth: minTouch }]}
        testID="map.anchor"
      >
        <Text style={[styles.actionText, { color: anchorAlarm?.active ? colors.success : colors.text }]}>{t('map.anchorShort')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('map.mobHold')}
        accessibilityHint={t('map.mobHoldHint')}
        accessibilityValue={mobProgress > 0 ? { text: `${Math.round(mobProgress * 100)}%` } : undefined}
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
    </>
  );

  return (
    <>
      <View style={inline ? styles.inlineColumn : undefined} pointerEvents="box-none">
        {buttons}
      </View>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={t('map.mapTools')} scrollable testID="map.tools.sheet">
        <SheetSection label={t('map.extrasLabel')} first>
          <View style={styles.chipRow}>
            <FilterChip label={t('map.rangeRings')} selected={showRangeRings} onPress={onToggleRangeRings} testID="map.rangeRings" />
            <FilterChip
              label={t('map.courseVector')}
              selected={mapShowCourseVector}
              onPress={() => void patchSettings({ mapShowCourseVector: !mapShowCourseVector })}
              testID="map.courseVector"
            />
            {mapShowCourseVector ? (
              <>
                {COURSE_VECTOR_MINUTE_OPTIONS.map((min) => (
                  <FilterChip
                    key={min}
                    label={t('settings.courseVectorMinutesOption', { min })}
                    selected={mapCourseVectorMinutes === min}
                    onPress={() => void patchSettings({ mapCourseVectorMinutes: min })}
                    testID={`map.courseVectorMinutes.${min}`}
                  />
                ))}
              </>
            ) : null}
            <FilterChip label={t('map.emergencyCopy')} selected={false} onPress={() => void copyEmergencyMessage()} testID="map.emergencyCopy" />
            <FilterChip
              label={t('map.screenLock')}
              selected={false}
              onPress={() => {
                setSheetOpen(false);
                void setScreenLocked(true);
              }}
              testID="map.screenLock"
            />
          </View>
        </SheetSection>
        {activityProfileId === 'sailing-race' ? (
          <>
            <SheetSection label={t('race.startLineTitle')}>
              <StartLineSection waypoints={waypoints} />
            </SheetSection>
            <RacePackSection />
          </>
        ) : null}
      </BottomSheet>

      <ActionSheet
        visible={anchorClearOpen}
        onClose={() => setAnchorClearOpen(false)}
        title={t('map.anchorClearTitle')}
        message={t('map.anchorClearBody')}
        options={[
          {
            label: t('map.anchorClearConfirm'),
            destructive: true,
            onPress: () => void clearAnchorAlarm(),
            testID: 'map.anchorClearConfirm',
          },
        ]}
        testID="map.anchorClear"
      />
    </>
  );
}

const styles = StyleSheet.create({
  inlineColumn: { flexDirection: 'column', gap: 10 },
  actionBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  actionText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  mobBtn: { overflow: 'hidden' },
  mobProgress: { position: 'absolute', left: 0, bottom: 0, height: 4, opacity: 0.9 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
