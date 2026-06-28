import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { activateAnchorAlarmAt } from '../../lib/anchor/activateAnchorAlarm';
import { isPassageMapPlanningActive } from '../../lib/passage/passageMapPlanning';
import {
  ANCHOR_RADIUS_NM_OPTIONS,
  COURSE_VECTOR_MINUTE_OPTIONS,
  COURSE_VECTOR_SCALE_OPTIONS,
  type AnchorRadiusNm,
} from '../../lib/settings/mapSettings';
import { courseVectorScaleLabelKey } from '../../lib/settings/courseVectorLabels';
import { formatDistanceNm, distanceUnitLabel } from '../../lib/geo/units';
import { isSafetyFixOk } from '../../lib/geo/fixQuality';
import {
  copyMaydayToClipboard,
  maydayCopyFeedbackKey,
  maydayUnavailableMessage,
} from '../../lib/emergency/copyMaydayClipboard';
import { useEffectiveLayoutPreset } from '../../hooks/useEffectiveLayoutPreset';
import { t } from '../../i18n';
import { useLocationStore } from '../../services/locationService';
import { useNavigationStore } from '../../store/navigationStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useMeasureDistanceStore } from '../../store/measureDistanceStore';
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
  const layoutPreset = useEffectiveLayoutPreset();
  const measureActive = useMeasureDistanceStore((s) => s.active);
  const startMeasure = useMeasureDistanceStore((s) => s.start);
  const stopMeasure = useMeasureDistanceStore((s) => s.stop);
  const mapShowCourseVector = useSettingsStore((s) => s.mapShowCourseVector);
  const mapCourseVectorMinutes = useSettingsStore((s) => s.mapCourseVectorMinutes);
  const mapCourseVectorScale = useSettingsStore((s) => s.mapCourseVectorScale);
  const anchorRadiusNm = useSettingsStore((s) => s.anchorRadiusNm);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const vessel = useSettingsStore((s) => s.vessel);
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const showError = useFeedbackStore((s) => s.showError);
  const dropMob = useNavigationStore((s) => s.dropMob);
  const createWaypoint = useWaypointStore((s) => s.create);
  const clearAnchorAlarm = useNavigationStore((s) => s.clearAnchorAlarm);
  const patchAnchorRadiusNm = useNavigationStore((s) => s.patchAnchorRadiusNm);
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const setScreenLocked = useNavigationStore((s) => s.setScreenLocked);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [anchorClearOpen, setAnchorClearOpen] = useState(false);
  const [mobProgress, setMobProgress] = useState(0);
  const mobTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mobStart = useRef<number | null>(null);
  const mobBusy = useRef(false);

  const clearMobTimer = useCallback(() => {
    if (mobTimer.current) clearInterval(mobTimer.current);
    mobTimer.current = null;
    mobStart.current = null;
    setMobProgress(0);
  }, []);

  useEffect(() => () => clearMobTimer(), [clearMobTimer]);

  const completeMobDrop = useCallback(async () => {
    if (mobBusy.current) return;
    if (!fix || !isSafetyFixOk(fix)) {
      showError(t('map.mobNoGpsBody'));
      return;
    }
    mobBusy.current = true;
    try {
      await dropMob(fix.latitude, fix.longitude);
      await createWaypoint({
        name: t('waypoints.types.mob'),
        latitude: fix.latitude,
        longitude: fix.longitude,
        type: 'mob',
      });
      showSuccess(t('map.mobDroppedBody'));
    } catch {
      showError(t('map.mobDropFailed'));
      await useNavigationStore.getState().clearMob().catch(() => {});
    } finally {
      mobBusy.current = false;
    }
  }, [fix, dropMob, createWaypoint, showError, showSuccess]);

  const onMobPressIn = useCallback(() => {
    if (mobBusy.current) return;
    mobStart.current = Date.now();
    mobTimer.current = setInterval(() => {
      if (!mobStart.current) return;
      const elapsed = Date.now() - mobStart.current;
      setMobProgress(Math.min(1, elapsed / MOB_HOLD_MS));
      if (elapsed >= MOB_HOLD_MS) {
        clearMobTimer();
        void completeMobDrop();
      }
    }, 50);
  }, [clearMobTimer, completeMobDrop]);

  const onMobPressOut = useCallback(() => {
    const startedAt = mobStart.current;
    if (startedAt && Date.now() - startedAt < MOB_HOLD_MS) {
      showInfo(t('map.mobHold'));
    }
    clearMobTimer();
  }, [clearMobTimer, showInfo]);

  async function copyEmergencyMessage() {
    const quality = await copyMaydayToClipboard(vessel, coordFormat);
    if (quality === 'unavailable') {
      showError(maydayUnavailableMessage());
      return;
    }
    const key = maydayCopyFeedbackKey(quality);
    if (quality === 'fresh') showSuccess(t(key));
    else showInfo(t(key));
  }

  async function setAnchorRadius(nm: AnchorRadiusNm) {
    if (anchorRadiusNm === nm && !anchorAlarm?.active) return;
    await patchSettings({ anchorRadiusNm: nm });
    if (anchorAlarm?.active) {
      await patchAnchorRadiusNm(nm);
      showInfo(
        t('map.anchorRadiusUpdated', {
          value: formatDistanceNm(nm, distanceUnit, 2),
          unit: distanceUnitLabel(distanceUnit),
        }),
      );
    }
  }

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

  async function toggleRangeRings() {
    if (layoutPreset === 'instruments-only' && !showRangeRings) {
      showInfo(t('map.rangeRingsNeedsChart'));
      return;
    }
    onToggleRangeRings();
  }

  function toggleMeasure() {
    if (layoutPreset === 'instruments-only') {
      showInfo(t('map.measureNeedsChart'));
      return;
    }
    if (isPassageMapPlanningActive()) {
      showInfo(t('map.measureBlockedPlanning'));
      return;
    }
    if (measureActive) {
      stopMeasure();
      return;
    }
    setSheetOpen(false);
    startMeasure();
    showInfo(t('map.measureStarted'));
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
        <SheetSection label={t('map.anchorWatchLabel')} first>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{t('map.anchorWatchMonitoringHint')}</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{t('map.anchorRadiusHint')}</Text>
          <View style={styles.chipRow}>
            {ANCHOR_RADIUS_NM_OPTIONS.map((nm) => (
              <FilterChip
                key={nm}
                label={t('map.anchorRadiusOption', {
                  value: formatDistanceNm(nm, distanceUnit, 2),
                  unit: distanceUnitLabel(distanceUnit),
                })}
                selected={Math.abs((anchorAlarm?.active ? anchorAlarm.radiusNm : anchorRadiusNm) - nm) < 0.001}
                onPress={() => void setAnchorRadius(nm)}
                testID={`map.anchorRadius.${nm}`}
              />
            ))}
          </View>
          {anchorAlarm?.active ? (
            <Text style={[styles.sectionHint, { color: colors.success }]} accessibilityRole="text">
              {t('map.anchorRadiusActive', {
                value: formatDistanceNm(anchorAlarm.radiusNm, distanceUnit, 2),
                unit: distanceUnitLabel(distanceUnit),
              })}
            </Text>
          ) : null}
        </SheetSection>
        <SheetSection label={t('map.courseVector')}>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{t('settings.courseVectorHint')}</Text>
          <View style={styles.chipRow}>
            <FilterChip
              label={t('map.courseVector')}
              selected={mapShowCourseVector}
              onPress={() => void patchSettings({ mapShowCourseVector: !mapShowCourseVector })}
              testID="map.courseVector"
            />
          </View>
          {mapShowCourseVector ? (
            <>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]} accessibilityRole="text">
                {t('settings.courseVectorMinutesHint')}
              </Text>
              <View style={styles.chipRow}>
                {COURSE_VECTOR_MINUTE_OPTIONS.map((min) => (
                  <FilterChip
                    key={min}
                    label={t('settings.courseVectorMinutesOption', { min })}
                    selected={mapCourseVectorMinutes === min}
                    onPress={() => void patchSettings({ mapCourseVectorMinutes: min })}
                    testID={`map.courseVectorMinutes.${min}`}
                  />
                ))}
              </View>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]} accessibilityRole="text">
                {t('settings.courseVectorScaleHint')}
              </Text>
              <View style={styles.chipRow}>
                {COURSE_VECTOR_SCALE_OPTIONS.map((scale) => (
                  <FilterChip
                    key={scale}
                    label={t(courseVectorScaleLabelKey(scale))}
                    selected={mapCourseVectorScale === scale}
                    onPress={() => void patchSettings({ mapCourseVectorScale: scale })}
                    testID={`map.courseVectorScale.${scale}`}
                  />
                ))}
              </View>
            </>
          ) : null}
        </SheetSection>
        <SheetSection label={t('map.extrasLabel')}>
          <View style={styles.chipRow}>
            <FilterChip
              label={t('map.measureDistance')}
              selected={measureActive}
              onPress={() => void toggleMeasure()}
              testID="map.measureDistance"
            />
            <FilterChip label={t('map.rangeRings')} selected={showRangeRings} onPress={() => void toggleRangeRings()} testID="map.rangeRings" />
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
      </BottomSheet>

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

const styles = StyleSheet.create({
  inlineColumn: { flexDirection: 'column', gap: 10 },
  actionBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  actionText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  mobBtn: { overflow: 'hidden' },
  mobProgress: { position: 'absolute', left: 0, bottom: 0, height: 4, opacity: 0.9 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionHint: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
