import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { MAP_ATTRIBUTION } from '../map/constants';
import { formatCoordinates } from '../map/coords';
import type { CoordFormat } from '../settings/defaults';
import { t } from '../i18n';
import { useFeedbackStore } from '../store/feedbackStore';
import { useLocationStore } from '../services/locationService';
import { syncBackgroundTrackRecording } from '../services/trackRecordingService';
import { useSettingsStore } from '../store/settingsStore';
import { useTrackStore } from '../store/trackStore';
import { type ThemeMode, useTheme } from '../theme/ThemeContext';
import { Button } from '../ui/Button';
import { FilterChip } from '../ui/FilterChip';
import { Card, FieldInput, FieldLabel, Screen } from '../ui/Screen';
import { SectionHeader } from '../ui/SectionHeader';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark', 'redNight', 'highContrast'];
const COORD_FORMATS: CoordFormat[] = ['ddm', 'dd', 'dms'];

export function SettingsScreen() {
  const { colors, mode, setMode, minTouch } = useTheme();
  const vessel = useSettingsStore((s) => s.vessel);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const sogUnit = useSettingsStore((s) => s.sogUnit);
  const distanceUnit = useSettingsStore((s) => s.distanceUnit);
  const bearingReference = useSettingsStore((s) => s.bearingReference);
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const mapCourseUp = useSettingsStore((s) => s.mapCourseUp);
  const followMode = useSettingsStore((s) => s.followMode);
  const keepAwakeUnderway = useSettingsStore((s) => s.keepAwakeUnderway);
  const backgroundTrackRecording = useSettingsStore((s) => s.backgroundTrackRecording);
  const alarmSoundEnabled = useSettingsStore((s) => s.alarmSoundEnabled);
  const alarmHapticEnabled = useSettingsStore((s) => s.alarmHapticEnabled);
  const legAdvanceAuto = useSettingsStore((s) => s.legAdvanceAuto);
  const refreshPermission = useLocationStore((s) => s.refreshPermission);
  const permission = useLocationStore((s) => s.permission);
  const showSuccess = useFeedbackStore((s) => s.showSuccess);
  const showInfo = useFeedbackStore((s) => s.showInfo);
  const [draft, setDraft] = useState(vessel);

  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  async function saveVessel() {
    await useSettingsStore.getState().updateVessel(draft);
    showSuccess(t('common.save'));
  }

  async function copyMayday() {
    const fix = useLocationStore.getState().fix ?? useLocationStore.getState().lastGoodFix;
    const pos = fix
      ? formatCoordinates(coordFormat, fix.latitude, fix.longitude)
      : t('map.awaitingGps');
    const lines = [
      'MAYDAY MAYDAY MAYDAY',
      draft.name ? `${t('settings.vesselName')}: ${draft.name}` : null,
      draft.callSign ? `${t('settings.callSign')}: ${draft.callSign}` : null,
      draft.mmsi ? `MMSI: ${draft.mmsi}` : null,
      draft.homePort ? `${t('settings.homePort')}: ${draft.homePort}` : null,
      `${t('settings.position')}: ${pos}`,
    ].filter(Boolean);
    const text = lines.join('\n');
    await Share.share({ message: text });
    showInfo(t('settings.emergencyCopy'));
  }

  async function requestBackgroundLocation() {
    const result = await Location.requestBackgroundPermissionsAsync();
    await refreshPermission();
    if (result.status === 'granted') {
      await patchSettings({ backgroundTrackRecording: true });
    }
  }

  const permissionLabel =
    permission === 'background'
      ? t('settings.locationBackgroundGranted')
      : permission === 'foreground'
        ? t('settings.locationForegroundGranted')
        : permission === 'denied'
          ? t('settings.locationDenied')
          : t('settings.locationUnknown');

  return (
    <Screen testID="screen.settings" title={t('settings.title')}>
      <SectionHeader first title={t('settings.displayTitle')} description={t('settings.displaySummary')} />
      <Card>
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('settings.themeLabel')}</Text>
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
        <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: 16 }]}>{t('settings.coordFormat')}</Text>
        <View style={styles.chipRow}>
          {COORD_FORMATS.map((f) => (
            <FilterChip
              key={f}
              label={f.toUpperCase()}
              selected={coordFormat === f}
              onPress={() => void patchSettings({ coordFormat: f })}
              testID={`settings.coord.${f}`}
            />
          ))}
        </View>
        <ToggleRow
          label={t('settings.courseUp')}
          value={mapCourseUp}
          onChange={(v) => void patchSettings({ mapCourseUp: v })}
          testID="settings.courseUp"
          colors={colors}
          minTouch={minTouch}
        />
        <ToggleRow
          label={t('settings.followMode')}
          value={followMode}
          onChange={(v) => void patchSettings({ followMode: v })}
          testID="settings.followMode"
          colors={colors}
          minTouch={minTouch}
        />
      </Card>

      <SectionHeader title={t('settings.unitsTitle')} />
      <Card>
        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{t('settings.sogUnit')}</Text>
        <View style={styles.chipRow}>
          {(['kn', 'mph', 'kmh', 'ms'] as const).map((u) => (
            <FilterChip key={u} label={u} selected={sogUnit === u} onPress={() => void patchSettings({ sogUnit: u })} testID={`settings.sog.${u}`} />
          ))}
        </View>
        <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: 16 }]}>{t('settings.distanceUnit')}</Text>
        <View style={styles.chipRow}>
          {(['nm', 'km', 'sm'] as const).map((u) => (
            <FilterChip key={u} label={u} selected={distanceUnit === u} onPress={() => void patchSettings({ distanceUnit: u })} testID={`settings.dist.${u}`} />
          ))}
        </View>
        <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: 16 }]}>{t('settings.bearingRef')}</Text>
        <View style={styles.chipRow}>
          <FilterChip label={t('settings.bearingTrue')} selected={bearingReference === 'true'} onPress={() => void patchSettings({ bearingReference: 'true' })} testID="settings.bearing.true" />
          <FilterChip label={t('settings.bearingMagnetic')} selected={bearingReference === 'magnetic'} onPress={() => void patchSettings({ bearingReference: 'magnetic' })} testID="settings.bearing.magnetic" />
        </View>
      </Card>

      <SectionHeader title={t('settings.vesselTitle')} />
      <Card>
        <FieldLabel>{t('settings.vesselName')}</FieldLabel>
        <FieldInput value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} accessibilityLabel={t('settings.vesselName')} />
        <FieldLabel>{t('settings.callSign')}</FieldLabel>
        <FieldInput value={draft.callSign} onChangeText={(callSign) => setDraft((d) => ({ ...d, callSign }))} accessibilityLabel={t('settings.callSign')} />
        <FieldLabel>{t('settings.mmsi')}</FieldLabel>
        <FieldInput value={draft.mmsi} onChangeText={(mmsi) => setDraft((d) => ({ ...d, mmsi }))} accessibilityLabel={t('settings.mmsi')} keyboardType="number-pad" />
        <FieldLabel>{t('settings.homePort')}</FieldLabel>
        <FieldInput value={draft.homePort} onChangeText={(homePort) => setDraft((d) => ({ ...d, homePort }))} accessibilityLabel={t('settings.homePort')} />
        <Button label={t('common.save')} onPress={() => void saveVessel()} testID="settings.vessel.save" />
      </Card>

      <SectionHeader title={t('settings.batteryTitle')} description={t('settings.batteryBody')} />
      <Card>
        <Text style={[styles.statusLine, { color: colors.text }]} accessibilityLiveRegion="polite">
          {permissionLabel}
        </Text>
        {Platform.OS === 'android' ? (
          <Button label={t('settings.openBatterySettings')} variant="secondary" onPress={() => void Linking.openSettings()} testID="settings.battery.open" />
        ) : null}
        <Button label={t('settings.requestBackgroundLocation')} variant="secondary" onPress={() => void requestBackgroundLocation()} testID="settings.location.background" />
        <ToggleRow label={t('settings.keepAwake')} value={keepAwakeUnderway} onChange={(v) => void patchSettings({ keepAwakeUnderway: v })} testID="settings.keepAwake" colors={colors} minTouch={minTouch} />
        <ToggleRow
          label={t('settings.backgroundTracks')}
          value={backgroundTrackRecording}
          onChange={(v) => {
            void patchSettings({ backgroundTrackRecording: v }).then(async () => {
              const trackId = useTrackStore.getState().recordingTrackId;
              if (trackId) await syncBackgroundTrackRecording(trackId);
            });
          }}
          testID="settings.backgroundTracks"
          colors={colors}
          minTouch={minTouch}
        />
      </Card>

      <SectionHeader title={t('settings.alarmsTitle')} description={t('settings.alarmsBody')} />
      <Card>
        <ToggleRow label={t('settings.alarmSound')} value={alarmSoundEnabled} onChange={(v) => void patchSettings({ alarmSoundEnabled: v })} testID="settings.alarmSound" colors={colors} minTouch={minTouch} />
        <ToggleRow label={t('settings.alarmHaptic')} value={alarmHapticEnabled} onChange={(v) => void patchSettings({ alarmHapticEnabled: v })} testID="settings.alarmHaptic" colors={colors} minTouch={minTouch} />
        <ToggleRow label={t('settings.legAdvanceAuto')} value={legAdvanceAuto} onChange={(v) => void patchSettings({ legAdvanceAuto: v })} testID="settings.legAdvanceAuto" colors={colors} minTouch={minTouch} />
      </Card>

      <SectionHeader title={t('settings.emergencyTitle')} />
      <Card>
        <Button label={t('settings.emergencyCopy')} variant="secondary" onPress={() => void copyMayday()} testID="settings.emergency.copy" />
      </Card>

      <SectionHeader title={t('settings.aboutTitle')} />
      <Card>
        <Text style={[styles.legal, { color: colors.textMuted }]}>{t('settings.disclaimerBody')}</Text>
        <Text style={[styles.legal, { color: colors.textMuted, marginTop: 12 }]}>{MAP_ATTRIBUTION}</Text>
        <Text style={[styles.version, { color: colors.text }]}>{t('settings.version', { v: '0.1.0' })}</Text>
      </Card>
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  testID,
  colors,
  minTouch,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID: string;
  colors: { text: string };
  minTouch: number;
}) {
  return (
    <View style={[styles.row, { minHeight: minTouch }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Switch accessibilityRole="switch" value={value} onValueChange={onChange} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  rowLabel: { fontSize: 15, flex: 1, marginRight: 12 },
  statusLine: { fontSize: 15, marginBottom: 12, fontWeight: '600' },
  legal: { fontSize: 14, lineHeight: 21 },
  version: { fontSize: 14, marginTop: 16, fontWeight: '600' },
});
