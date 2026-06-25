import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useFormFactor } from '../hooks/useFormFactor';
import { useEffectiveLayoutPreset, useLayoutContext } from '../hooks/useEffectiveLayoutPreset';
import { useBatteryOptimization } from '../hooks/useBatteryOptimization';
import { RACING_PACK_V11 } from '../lib/featureFlags';
import { COURSE_VECTOR_MINUTE_OPTIONS, FOLLOW_ZOOM_OPTIONS } from '../lib/settings/mapSettings';
import { buildMaydayMessage } from '../lib/emergency/maydayMessage';
import { openBatteryOptimizationSettings, requestBatteryOptimizationExemption } from '../lib/permissions/batteryOptimization';
import { openSystemSettings, requestBackgroundLocationAccess } from '../lib/permissions/locationPermissions';
import { MAP_ATTRIBUTION } from '../map/constants';
import type { PanelSide } from '../settings/defaults';
import { ACTIVITY_PROFILES, LAYOUT_PRESETS } from '../settings/profiles';
import { t } from '../i18n';
import { useNavigationStore } from '../store/navigationStore';
import { useFeedbackStore } from '../store/feedbackStore';
import { useLocationStore } from '../services/locationService';
import { syncBackgroundLocationMonitoring, isBackgroundLocationRunning } from '../services/backgroundLocationService';
import { ensureMaritimeAlarmNotifications, getMaritimeNotificationPermission } from '../services/maritimeAlarmNotifications';
import { useSettingsStore } from '../store/settingsStore';
import { type ThemeMode, useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { CoordFormatPicker } from '../ui/CoordFormatPicker';
import { FilterChip } from '../ui/FilterChip';
import { RacePackSection } from '../features/racing/RacePackSection';
import { ButtonStack, Card, FieldGroup, FieldInput, Screen, SettingsGroup } from '../ui/Screen';
import { SectionHeader } from '../ui/SectionHeader';
import { ToggleRow } from '../ui/ToggleRow';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark', 'redNight', 'highContrast'];
const PANEL_SIDES: PanelSide[] = ['auto', 'port', 'starboard'];

export function SettingsScreen() {
  const { colors, mode, setMode, minTouch } = useTheme();
  const { formFactor } = useFormFactor();
  const twoColumn = formFactor === 'expanded';
  const vessel = useSettingsStore((s) => s.vessel);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const mapCourseUp = useSettingsStore((s) => s.mapCourseUp);
  const mapShowCourseVector = useSettingsStore((s) => s.mapShowCourseVector);
  const mapCourseVectorMinutes = useSettingsStore((s) => s.mapCourseVectorMinutes);
  const mapFollowZoom = useSettingsStore((s) => s.mapFollowZoom);
  const followMode = useSettingsStore((s) => s.followMode);
  const keepAwakeUnderway = useSettingsStore((s) => s.keepAwakeUnderway);
  const backgroundTrackRecording = useSettingsStore((s) => s.backgroundTrackRecording);
  const alarmSoundEnabled = useSettingsStore((s) => s.alarmSoundEnabled);
  const alarmHapticEnabled = useSettingsStore((s) => s.alarmHapticEnabled);
  const legAdvanceAuto = useSettingsStore((s) => s.legAdvanceAuto);
  const gloveMode = useSettingsStore((s) => s.gloveMode);
  const panelSide = useSettingsStore((s) => s.panelSide);
  const activityProfileId = useSettingsStore((s) => s.activityProfileId);
  const applyActivityProfile = useSettingsStore((s) => s.applyActivityProfile);
  const setLayoutOverride = useSettingsStore((s) => s.setLayoutOverride);
  const layoutPreset = useEffectiveLayoutPreset();
  const layoutContext = useLayoutContext();
  const alarmLimits = useNavigationStore((s) => s.alarmLimits);
  const patchAlarmLimits = useNavigationStore((s) => s.patchAlarmLimits);
  const refreshPermission = useLocationStore((s) => s.refreshPermission);
  const permission = useLocationStore((s) => s.permission);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [draft, setDraft] = useState(vessel);
  const [notificationPermission, setNotificationPermission] = useState(getMaritimeNotificationPermission());
  const [backgroundGpsRunning, setBackgroundGpsRunning] = useState(false);
  const batteryStatus = useBatteryOptimization(Platform.OS === 'android');

  const refreshBackgroundStatus = useCallback(async () => {
    await refreshPermission();
    setBackgroundGpsRunning(await isBackgroundLocationRunning());
    await ensureMaritimeAlarmNotifications().then(() => setNotificationPermission(getMaritimeNotificationPermission()));
  }, [refreshPermission]);

  useEffect(() => {
    void refreshBackgroundStatus();
  }, [refreshBackgroundStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshBackgroundStatus();
    }, [refreshBackgroundStatus]),
  );

  async function saveVessel() {
    await useSettingsStore.getState().updateVessel(draft);
    showSuccess(t('common.save'));
  }

  async function copyMayday() {
    const fix = useLocationStore.getState().fix ?? useLocationStore.getState().lastGoodFix;
    const text = buildMaydayMessage(draft, fix, coordFormat);
    await Clipboard.setStringAsync(text);
    showInfo(t('settings.emergencyCopy'));
  }

  async function requestBackgroundLocation() {
    const status = await requestBackgroundLocationAccess();
    await syncBackgroundLocationMonitoring();
    await refreshBackgroundStatus();
    if (status !== 'granted') {
      showInfo(t('permissions.backgroundDeniedHint'));
    } else {
      showSuccess(t('permissions.backgroundGrantedHint'));
    }
  }

  async function requestBatteryExemption() {
    if (Platform.OS !== 'android') return;
    try {
      await requestBatteryOptimizationExemption();
    } catch {
      await openBatteryOptimizationSettings();
    }
    await syncBackgroundLocationMonitoring();
    await refreshBackgroundStatus();
  }

  async function requestAlarmNotifications() {
    const ok = await ensureMaritimeAlarmNotifications();
    setNotificationPermission(getMaritimeNotificationPermission());
    if (ok) showSuccess(t('settings.alarmNotificationsGranted'));
    else showInfo(t('settings.alarmNotificationsDenied'));
  }

  const permissionLabel =
    permission === 'background'
      ? t('settings.locationBackgroundGranted')
      : permission === 'foreground'
        ? t('settings.locationForegroundGranted')
        : permission === 'denied'
          ? t('settings.locationDenied')
          : t('settings.locationUnknown');

  const batteryLabel =
    batteryStatus === 'exempt'
      ? t('settings.batteryExempt')
      : batteryStatus === 'restricted'
        ? t('settings.batteryRestricted')
        : t('settings.batteryUnknown');

  const backgroundGpsLabel = backgroundGpsRunning ? t('settings.backgroundGpsRunning') : t('settings.backgroundGpsStopped');

  const displayCard = (
    <Card style={twoColumn ? { flex: 1 } : undefined}>
      {twoColumn ? (
        <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">
          {t('settings.displayTitle')}
        </Text>
      ) : null}

      <SettingsGroup title={t('settings.themeLabel')} first>
        <View style={styles.chipRow}>
          {THEME_MODES.map((m) => (
            <FilterChip
              key={m}
              label={t(`settings.themes.${m}` as 'settings.themes.system')}
              selected={mode === m}
              onPress={() => setMode(m)}
              testID={`settings.theme.${m}`}
            />
          ))}
        </View>
      </SettingsGroup>

      <SettingsGroup title={t('settings.activityProfile')} hint={t('settings.activityProfileHint')}>
        <View style={styles.chipRow}>
          {ACTIVITY_PROFILES.map((p) => (
            <FilterChip
              key={p.id}
              label={t(p.labelKey as 'profiles.cruisePassage')}
              selected={activityProfileId === p.id}
              onPress={() => void applyActivityProfile(p.id)}
              testID={`settings.profile.${p.id}`}
            />
          ))}
        </View>
      </SettingsGroup>

      <SettingsGroup title={t('settings.layoutTitle')} hint={t('settings.layoutSummary')}>
        <View style={styles.chipRow}>
          {LAYOUT_PRESETS.map((preset) => (
            <FilterChip
              key={preset}
              label={t(`map.layouts.${preset}` as 'map.layouts.map-forward')}
              selected={layoutPreset === preset}
              onPress={() => void setLayoutOverride(preset, layoutContext)}
              testID={`settings.layout.${preset}`}
            />
          ))}
        </View>
        <Text style={[styles.layoutDescription, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}>
          {t(`settings.layoutDescriptions.${layoutPreset}` as 'settings.layoutDescriptions.map-forward')}
        </Text>
      </SettingsGroup>

      <SettingsGroup title={t('settings.coordFormat')} hint={t('settings.coordFormatHint')}>
        <CoordFormatPicker value={coordFormat} onChange={(f) => void patchSettings({ coordFormat: f })} />
      </SettingsGroup>

      <SettingsGroup title={t('settings.mapBehaviourTitle')}>
        <ToggleRow
          label={t('settings.courseUp')}
          value={mapCourseUp}
          onChange={(v) => void patchSettings({ mapCourseUp: v })}
          testID="settings.courseUp"
          colors={colors}
          minTouch={minTouch}
        />
        <ToggleRow
          label={t('settings.courseVector')}
          hint={t('settings.courseVectorHint')}
          value={mapShowCourseVector}
          onChange={(v) => void patchSettings({ mapShowCourseVector: v })}
          testID="settings.courseVector"
          colors={colors}
          minTouch={minTouch}
        />
        {mapShowCourseVector ? (
          <SettingsGroup title={t('settings.courseVectorMinutes')} hint={t('settings.courseVectorMinutesHint')}>
            <View style={styles.chipRow}>
              {COURSE_VECTOR_MINUTE_OPTIONS.map((min) => (
                <FilterChip
                  key={min}
                  label={t('settings.courseVectorMinutesOption', { min })}
                  selected={mapCourseVectorMinutes === min}
                  onPress={() => void patchSettings({ mapCourseVectorMinutes: min })}
                  testID={`settings.courseVectorMinutes.${min}`}
                />
              ))}
            </View>
          </SettingsGroup>
        ) : null}
        <SettingsGroup title={t('settings.followZoom')} hint={t('settings.followZoomHint')}>
          <View style={styles.chipRow}>
            {FOLLOW_ZOOM_OPTIONS.map((zoom) => (
              <FilterChip
                key={zoom}
                label={String(zoom)}
                selected={mapFollowZoom === zoom}
                onPress={() => void patchSettings({ mapFollowZoom: zoom })}
                testID={`settings.followZoom.${zoom}`}
              />
            ))}
          </View>
        </SettingsGroup>
        <ToggleRow
          label={t('settings.followMode')}
          value={followMode}
          onChange={(v) => void patchSettings({ followMode: v })}
          testID="settings.followMode"
          colors={colors}
          minTouch={minTouch}
        />
        <ToggleRow
          label={t('settings.gloveMode')}
          hint={t('settings.gloveModeHint')}
          value={gloveMode}
          onChange={(v) => void patchSettings({ gloveMode: v })}
          testID="settings.gloveMode"
          colors={colors}
          minTouch={minTouch}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.panelSide')}>
        <View style={styles.chipRow}>
          {PANEL_SIDES.map((side) => (
            <FilterChip
              key={side}
              label={t(`settings.panelSide${side === 'auto' ? 'Auto' : side === 'port' ? 'Port' : 'Starboard'}` as 'settings.panelSideAuto')}
              selected={panelSide === side}
              onPress={() => void patchSettings({ panelSide: side })}
              testID={`settings.panelSide.${side}`}
            />
          ))}
        </View>
      </SettingsGroup>
    </Card>
  );

  const unitsCard = (
    <Card style={twoColumn ? { flex: 1 } : undefined}>
      {twoColumn ? (
        <Text style={[styles.cardTitle, { color: colors.text }]} accessibilityRole="header">
          {t('settings.unitsTitle')}
        </Text>
      ) : null}

      <SettingsGroup title={t('settings.sogUnit')} hint={t('settings.sogUnitHint')} first>
        <View style={styles.chipRow}>
          {(['kn', 'mph', 'kmh', 'ms'] as const).map((u) => (
            <FilterChip key={u} label={u} selected={sogUnit === u} onPress={() => void patchSettings({ sogUnit: u })} testID={`settings.sog.${u}`} />
          ))}
        </View>
      </SettingsGroup>

      <SettingsGroup title={t('settings.distanceUnit')}>
        <View style={styles.chipRow}>
          {(['nm', 'km', 'sm'] as const).map((u) => (
            <FilterChip key={u} label={u} selected={distanceUnit === u} onPress={() => void patchSettings({ distanceUnit: u })} testID={`settings.dist.${u}`} />
          ))}
        </View>
      </SettingsGroup>

      <SettingsGroup title={t('settings.bearingRef')} hint={t('settings.bearingRefHint')}>
        <View style={styles.chipRow}>
          <FilterChip label={t('settings.bearingTrue')} selected={bearingReference === 'true'} onPress={() => void patchSettings({ bearingReference: 'true' })} testID="settings.bearing.true" />
          <FilterChip label={t('settings.bearingMagnetic')} selected={bearingReference === 'magnetic'} onPress={() => void patchSettings({ bearingReference: 'magnetic' })} testID="settings.bearing.magnetic" />
        </View>
      </SettingsGroup>
    </Card>
  );

  return (
    <Screen testID="screen.settings" title={t('settings.title')}>
      {!twoColumn ? <SectionHeader first title={t('settings.displayTitle')} description={t('settings.displaySummary')} /> : null}
      <View style={twoColumn ? styles.twoCol : undefined}>
        {displayCard}
        {!twoColumn ? <SectionHeader title={t('settings.unitsTitle')} /> : null}
        {unitsCard}
      </View>

      <SectionHeader title={t('settings.vesselTitle')} />
      <Card>
        <FieldGroup label={t('settings.vesselName')}>
          <FieldInput value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} accessibilityLabel={t('settings.vesselName')} />
        </FieldGroup>
        <FieldGroup label={t('settings.callSign')}>
          <FieldInput value={draft.callSign} onChangeText={(callSign) => setDraft((d) => ({ ...d, callSign }))} accessibilityLabel={t('settings.callSign')} />
        </FieldGroup>
        <FieldGroup label={t('settings.mmsi')}>
          <FieldInput value={draft.mmsi} onChangeText={(mmsi) => setDraft((d) => ({ ...d, mmsi }))} accessibilityLabel={t('settings.mmsi')} keyboardType="number-pad" />
        </FieldGroup>
        <FieldGroup label={t('settings.homePort')}>
          <FieldInput value={draft.homePort} onChangeText={(homePort) => setDraft((d) => ({ ...d, homePort }))} accessibilityLabel={t('settings.homePort')} />
        </FieldGroup>
        <ButtonStack>
          <Button label={t('common.save')} onPress={() => void saveVessel()} testID="settings.vessel.save" />
        </ButtonStack>
      </Card>

      <SectionHeader title={t('settings.batteryTitle')} description={t('settings.batteryBody')} />
      <Card>
        <Text style={[styles.statusLine, { color: colors.text }]} accessibilityLiveRegion="polite">
          {permissionLabel}
        </Text>
        {Platform.OS === 'android' ? (
          <Text style={[styles.statusLine, { color: colors.text }]} accessibilityLiveRegion="polite">
            {batteryLabel}
          </Text>
        ) : null}
        <Text style={[styles.statusLine, { color: colors.text }]} accessibilityLiveRegion="polite">
          {backgroundGpsLabel}
        </Text>
        <Text style={[styles.bodyText, { color: colors.textMuted }]}>{t('settings.anchorBackgroundHint')}</Text>
        <ButtonStack>
          {permission === 'denied' ? (
            <Button label={t('permissions.openSettings')} variant="secondary" onPress={() => void openSystemSettings()} testID="settings.location.open" />
          ) : null}
          {Platform.OS === 'android' ? (
            <>
              <Button label={t('settings.exemptBatteryPrompt')} variant="secondary" onPress={() => void requestBatteryExemption()} testID="settings.battery.exempt" />
              <Button label={t('settings.openBatterySettings')} variant="ghost" onPress={() => void openBatteryOptimizationSettings()} testID="settings.battery.open" />
            </>
          ) : null}
          <Button label={t('settings.requestBackgroundLocation')} variant="secondary" onPress={() => void requestBackgroundLocation()} testID="settings.location.background" />
        </ButtonStack>
        <SettingsGroup title={t('settings.underwayGpsTitle')}>
          <ToggleRow label={t('settings.keepAwake')} value={keepAwakeUnderway} onChange={(v) => void patchSettings({ keepAwakeUnderway: v })} testID="settings.keepAwake" colors={colors} minTouch={minTouch} />
          <ToggleRow
            label={t('settings.backgroundTracks')}
            value={backgroundTrackRecording}
            onChange={(v) => {
              void patchSettings({ backgroundTrackRecording: v }).then(async () => {
                await syncBackgroundLocationMonitoring();
              });
            }}
            testID="settings.backgroundTracks"
            colors={colors}
            minTouch={minTouch}
          />
        </SettingsGroup>
      </Card>

      <SectionHeader title={t('settings.alarmsTitle')} description={t('settings.alarmsBody')} />
      <Card>
        <Text style={[styles.bodyText, { color: colors.textMuted }]}>
          {notificationPermission === 'granted' ? t('settings.alarmNotificationsOn') : t('settings.alarmNotificationsOff')}
        </Text>
        <ButtonStack>
          <Button label={t('settings.alarmNotificationsEnable')} variant="secondary" onPress={() => void requestAlarmNotifications()} testID="settings.alarmNotifications" />
        </ButtonStack>
        <SettingsGroup title={t('settings.alarmFeedbackTitle')}>
          <ToggleRow label={t('settings.alarmSound')} value={alarmSoundEnabled} onChange={(v) => void patchSettings({ alarmSoundEnabled: v })} testID="settings.alarmSound" colors={colors} minTouch={minTouch} />
          <ToggleRow label={t('settings.alarmHaptic')} value={alarmHapticEnabled} onChange={(v) => void patchSettings({ alarmHapticEnabled: v })} testID="settings.alarmHaptic" colors={colors} minTouch={minTouch} />
          <ToggleRow label={t('settings.legAdvanceAuto')} value={legAdvanceAuto} onChange={(v) => void patchSettings({ legAdvanceAuto: v })} testID="settings.legAdvanceAuto" colors={colors} minTouch={minTouch} />
        </SettingsGroup>
        <SettingsGroup title={t('settings.alarmLimitsTitle')}>
          <FieldGroup label={t('settings.alarmXteNm')}>
            <FieldInput
              value={String(alarmLimits.xteNm)}
              onChangeText={(v) => {
                const n = Number.parseFloat(v.replace(',', '.'));
                if (Number.isFinite(n) && n > 0) void patchAlarmLimits({ xteNm: n });
              }}
              keyboardType="number-pad"
              accessibilityLabel={t('settings.alarmXteNm')}
            />
          </FieldGroup>
          <FieldGroup label={t('settings.alarmArrivalNm')}>
            <FieldInput
              value={String(alarmLimits.arrivalNm)}
              onChangeText={(v) => {
                const n = Number.parseFloat(v.replace(',', '.'));
                if (Number.isFinite(n) && n > 0) void patchAlarmLimits({ arrivalNm: n });
              }}
              keyboardType="number-pad"
              accessibilityLabel={t('settings.alarmArrivalNm')}
            />
          </FieldGroup>
        </SettingsGroup>
      </Card>

      {RACING_PACK_V11 && activityProfileId === 'sailing-race' ? (
        <>
          <SectionHeader title={t('settings.racingTitle')} description={t('settings.racingSummary')} />
          <Card>
            <RacePackSection embedded />
          </Card>
        </>
      ) : null}

      <SectionHeader title={t('settings.emergencyTitle')} />
      <Card>
        <ButtonStack>
          <Button label={t('settings.emergencyCopy')} variant="secondary" onPress={() => void copyMayday()} testID="settings.emergency.copy" />
        </ButtonStack>
      </Card>

      <SectionHeader title={t('settings.aboutTitle')} />
      <Card>
        <Text style={[styles.bodyText, { color: colors.textMuted }]}>{t('settings.disclaimerBody')}</Text>
        <Text style={[styles.bodyText, { color: colors.textMuted }]}>{MAP_ATTRIBUTION}</Text>
        <Text style={[styles.version, { color: colors.text }]}>{t('settings.version', { v: '0.1.0' })}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  twoCol: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  layoutDescription: { fontSize: 14, lineHeight: 21, borderWidth: 1, borderRadius: 12, padding: 12 },
  statusLine: { fontSize: 15, fontWeight: '700' },
  bodyText: { fontSize: 14, lineHeight: 21 },
  version: { fontSize: 14, fontWeight: '600' },
});
